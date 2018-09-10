// Docservice RESTful API for storing HTML documents, links, and references
//
// Exposes the following:
//
// Title: Store new document with [key]
// URL: /docservice/[key]
// Method: POST
// URL params: None
// Data params: JSON describing the document conforming to the following model:
//
// {
//   "html": "<string>",
//   "links": [
//     {
//       "id": <int>,
//       "title": "<string>",
//       "uri": "<string>"
//     },
//     // ...
//   ],
//   "references": [
//     {
//       "anchor": "<string>",
//       "position": <int>,
//       "link": <link-id>
//     },
//     // ...
//   ]
//  }
//
// Where link IDs are client defined, and reference link-ids match link IDs.
// Success response: JSON with the given key and newly assigned ID for this document's version
// 
// {
//   "key": "<key>",
//   "id": "<cassandra-timeuuid>"
// }
//
// Title: Get document (specific version)
// URL: /docservice/[key]/[id]/html
// Method: GET
// URL params: None
// Success response: JSON with the given key, ID, and the associated HTML for the document
//
// {
//   "key": "<key>",
//   "id": "<cassandra-timeuuid>"
//   "html": "<your-document-html>"
// }
//
// Title: Get all documents for a given key
// URL: /docservice/[key]/all/html
// Method: GET
// URL params: None
// Success response: JSON with the given key and further chunked by each stored ID, 
// and the associated HTML for that document
//
// {
//   "key": "<key>",
//   "docs": [
//     {
//       "id": "<cassandra-timeuuid>"
//       "html": "<your-document-html>"
//     },
//     // ...
//   ]
// }
//
// Title: Get links for a given specific document (key/id tuple)
// URL: /docservice/[key]/[id]/links
// Method: GET
// URL params: None
// Success response: JSON with the given key, id, and further chunked by each stored link:
// {
//   "key": "<key>",
//   "id": "<cassandra-timeuuid>",
//   "links": [
//     {
//       "id": <int>,
//       "title": "<string>",
//       "uri": "<string>"
//     },
//     // ...
//   ],
// }
//
// Title: Get references for a given specific document (key/id tuple)
// URL: /docservice/[key]/[id]/references
// Method: GET
// URL params: None
// Success response: JSON with the given key, id, and further chunked by each stored reference, 
// {
//   "key": "<key>",
//   "id": "<cassandra-timeuuid>",
//   "references": [
//     {
//       "anchor": "<string>",
//       "position": <int>,
//       "link": <link-id>
//     },
//     // ...
//   ]
// }
//
// Services not exposed:
//   This service does not allow the deletion or modification of stored documents. Thus,
//   PUT, PATCH, and DELETE are not implemented.
//
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const docService = require('./docService');

app.use(bodyParser.json());
app.get('/docservice/:key/:id/html', (req, res) => docService.getDoc(req, res));
app.get('/docservice/:key/:id/links', (req, res) => docService.getLinks(req, res));
app.get('/docservice/:key/:id/references', (req, res) => docService.getReferences(req, res));
app.post('/docservice/:key', (req, res) => docService.postDoc(req, res));

docService.setupDB();

app.listen(3000, () => console.log('Example app listening on port 3000!'));