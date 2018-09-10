const cassandra = require('cassandra-driver');
const sysClient = new cassandra.Client({ contactPoints: ['localhost'], keyspace: 'system' });
var client;
const timeUuid = cassandra.types.TimeUuid;

// Document CQL statements
// Provides the following capabilities:
//   - Insert new document (html, links, references)
//   - Get HTML for one specific document (key, id tuple)
//	 - Get all IDs and htmls for one key
//   - Get all links for one specific document
//	 - Get all references for one specific document
const insertDocCQL = "INSERT INTO documents (key, id, html) values (?, ?, ?)";
const getDocCQL = "SELECT html FROM documents where key=? and id=?";
const getAllDocVersionsCQL = "SELECT id, html FROM documents where key=? ORDER BY id DESC";

const insertLinkCQL = "INSERT INTO links (key, id, linkid, title, uri) VALUES (?, ?, ?, ?, ?)";
const getAllLinksCQL = "SELECT linkid, title, uri FROM links WHERE key=? and id=?";

const insertRefCQL = "INSERT INTO references (key, id, linkid, anchor, position) VALUES (?, ?, ?, ?, ? )";
const getAllRefsCQL = "SELECT anchor, position, linkid FROM references WHERE key=? and id=?";

// Data definition
// Creates (if these don't exist):
//   - docservice keyspace with simple replication strategy to 3 nodes
//	 - documents table to hold all versions of a document by key
//   - links table to hold all links for each specific document (key, id tuple)
//   - references table to hold all references for each specific reference
//
// Design decisions:
//   Documents table has a primary key on (key,id) in order to partition the table by key, and then cluster by ID.
//   All documents can be read from a single partition, and we can order by ID to fetch documents in the order they were added.
//
//   Links and references has a primary key on ((key,id),linkid) in order to partition the table by each specific document,
//   and cluster by all of the links/references for each document. This enables fast reading of links and references for a 
//   given document, but reading all links and references for a given key is not as fast. Cassandra works best when a read can
//   be done from a single partition, which this design decision does not support.
const keyspaceDef = "CREATE KEYSPACE IF NOT EXISTS docservice WITH replication = {'class' : 'SimpleStrategy', 'replication_factor': 3 }";

const docTableDef = `CREATE TABLE IF NOT EXISTS docservice.documents (
	key varchar,
	id timeuuid,
	html varchar,
	PRIMARY KEY (key, id)
);`;

const linksTableDef = `CREATE TABLE IF NOT EXISTS docservice.links (
	key varchar,
	id timeuuid,
	linkid int,
	title varchar,
	uri varchar,
	PRIMARY KEY ((key, id), linkid)
);`;

const refTableDef = `CREATE TABLE IF NOT EXISTS docservice.references (
	key varchar,
	id timeuuid,
	linkid int,
	anchor varchar,
	position int,
	PRIMARY KEY ((key, id), linkid)
);`;

module.exports = {
	postDoc: postDoc,
	getDoc: getDoc,
	getLinks: getLinks,
	getReferences: getReferences,
	setupDB: setupDB
}

/**
  * Handles the POST request to store a new version of a document
  *
  * @param {express request} req The Express request object for the POST request
  * @param {express response} res The Express response object for the request
  *
  */
function postDoc(req, res) {
	var key = req.params.key;
	var doc = req.body;
	var myUuid = timeUuid.now();
	var response = {};

	if (!doc.html || doc.html === "")
	{
		res.sendStatus(500);
		return;
	}

	var queries = [
		{
			query: insertDocCQL,
			params: [key, myUuid, doc.html]
		}
	];

    if (doc.links)
    {
		doc.links.forEach(function(val) {
			queries.push(
				{
					query: insertLinkCQL, 
					params: [key, myUuid, val.id, val.title, val.uri]
				}
			);
		});
	}

	if (doc.references)
	{
		doc.references.forEach(function(val) {
			queries.push(
				{
					query: insertRefCQL,
					params: [key, myUuid, val.link, val.anchor, val.position]
				}
			);
		});
	}

	response.key = key;
	response.id = myUuid;
	client.batch(queries, {prepare: true}).then(result => res.send(response));
}

/**
  * Handles the GET request to fetch a document from the database. If the
  * request URL includes 'all' for the ID, then we fetch all the documents
  * for the given key. Otherwise we'll get the specific version from the
  * tuple (key,id).
  *
  * @param {express request} req The Express request object for the POST request
  * @param {express response} res The Express response object for the request
  *
  */
function getDoc(req, res) {
	var doc = {};
	if ( req.params.id === "all" )
		cqlGetAllHTML(req.params.key, (result) => res.send(result));
	else
		cqlGetHTML(req.params.key, req.params.id, (result) => res.send(result));
}

/**
  * Handles the GET request to fetch all links for a document from the database
  * for a (key,id) tuple decoded from the request object.
  *
  * @param {express request} req The Express request object for the POST request
  * @param {express response} res The Express response object for the request
  *
  */
function getLinks(req, res) {
	cqlGetLinks(req.params.key, req.params.id, (result) => res.send(result));
}

/**
  * Handles the GET request to fetch all links for a document from the database
  * for a (key,id) tuple decoded from the request object.
  *
  * @param {express request} req The Express request object for the POST request
  * @param {express response} res The Express response object for the request
  *
  */
function getReferences(req, res) {
	cqlGetReferences(req.params.key, req.params.id, (result) => res.send(result));
}

/**
  * Fetches a specific document from the Cassandra DB, builds up a result object
  * and fires the callback to the sender.
  *
  * @param {string} key The document key.
  * @param {cassandra-timeuuid} id The document id.
  * @param {function} callback The function to call back when the results are complete.
  */
function cqlGetHTML(key, id, callback)
{
	var result = {};
	result.key = key;
	result.id = id;
	client.stream(getDocCQL, [key, id])
		.on('readable', function() {
				result.html = this.read().html;
			}
		)
		.on('error', function(err, reject) {
				console.log(err);
			}
		)
		.on('end', function() {
				callback(result);
			}
		);
}

/**
  * Fetches all documents from the Cassandra DB for the key, builds up a result object
  * and fires the callback to the sender.
  *
  * @param {string} key The document key.
  * @param {function} callback The function to call back when the results are complete.
  */
function cqlGetAllHTML(key, callback)
{
	var result = {};
	result.docs = [];
	result.key = key;

	client.stream(getAllDocVersionsCQL, [key])
		.on('readable', function() {
			let row;
			while(row = this.read()) {
				let doc = {};
				console.log("adding id %s", row.id);
				doc.id = row.id;
				doc.html = row.html;
				result.docs.push(doc);
			}
		})
		.on('error', function(err, reject) {
				console.log(err);
			}
		)
		.on('end', function() {
				callback(result);
			}
		);
}

/**
  * Fetches all links from the Cassandra DB for a specific document, builds up a result object
  * and fires the callback to the sender.
  *
  * @param {string} key The document key.
  * @param {cassandra-timeuuid} id The document id.
  * @param {function} callback The function to call back when the results are complete.
  */
function cqlGetLinks(key, id, callback)
{
	var result = {};
	result.key = key;
	result.id = id;
	result.links = [];

	client.stream(getAllLinksCQL, [key, id])
		.on('readable', function() {
				let link = {};
				let row;

				while(row = this.read()) {
					link.id = row.linkid;
					link.title = row.title;
					link.uri = row.uri;
					result.links.push(link);
				}
			}
		)
		.on('error', function(err, reject) {
				console.log(err);
			}
		)
		.on('end', function() {
				callback(result);
			}
		);
}

/**
  * Fetches all references from the Cassandra DB for a specific document, builds up a result object
  * and fires the callback to the sender.
  *
  * @param {string} key The document key.
  * @param {cassandra-timeuuid} id The document id.
  * @param {function} callback The function to call back when the results are complete.
  */
function cqlGetReferences(key, id, callback) {
	var result = {};
	result.key = key;
	result.id = id;
	result.references = [];

	client.stream(getAllRefsCQL, [key, id])
		.on('readable', function() {
				let reference = {};
				let row;

				while(row = this.read()) {
					reference.anchor = row.anchor;
					reference.position = row.position;
					reference.link = row.linkid;
					result.references.push(reference);
				}
			}
		)
		.on('error', function(err, reject) {
				console.log(err);
			}
		)
		.on('end', function() {
				callback(result);
			}
		);

}

/**
  * Sets up the database with the keyspace and tables we need to store and serve documents.
  * Takes the already established connection to the system keyspace and creates our
  * docservice keyspace if it doesn't exist. Then creates our tables if they don't exist
  * under the docservice keyspace and closes the connection to the system keyspace.
  *
  */
function setupDB() {
	console.log("Setting up the database");
	sysClient.execute(keyspaceDef).then(function() { 
		client = new cassandra.Client({ contactPoints: ['localhost'], keyspace: 'docservice' });
		client.execute(docTableDef);
		client.execute(linksTableDef);
		client.execute(refTableDef);
		sysClient.shutdown().then(() => console.log("Closed connection to system keyspace"));
	});
}