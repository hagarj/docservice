# DocService by Jason Hagar

This RESTful service fulfills the take home test provided. It obeys the following client contract as specified for posting new documents:

> {
> &nbsp;&nbsp;"html": "\<string>", 
> &nbsp;&nbsp;"links": [
> &nbsp;&nbsp;&nbsp;&nbsp;{
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id":\<int>,
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"title": "\<string>",
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"uri": "\<string>"
> &nbsp;&nbsp;&nbsp;&nbsp;}, &nbsp;&nbsp;&nbsp;&nbsp;// ...
> &nbsp;&nbsp;], &nbsp;&nbsp;
> &nbsp;&nbsp;"references": [
> &nbsp;&nbsp;&nbsp;&nbsp;{
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"anchor": "\<string>",
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"position": \<int>,
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"link": \<link-id>
> &nbsp;&nbsp;&nbsp;&nbsp;}
> &nbsp;&nbsp;&nbsp;&nbsp;// ...
> &nbsp;&nbsp;]
> }

# Implemented Features
The following features have been implemented:

 - POST new documents
 - GET HTML of a specific version of a document (key, id tuple)
 - GET HTML of all versions of a document
 - GET links of a specific version of a document
 - GET references of a specific version of a document 

# Assumptions

I have assumed that the service is to not allow deletes or modifications, as those features were not specified in the assignment. Thus, PUT, PATCH, and DELETE verbs are not supported.

I went ahead and selected Cassandra for the data storage backend. This seemed like a good choice for the following reasons:

 - Cassandra is designed for high performance and reliability.
 - Automatic support for replication across sites is built-in. Not used in this implementation, but could easily be modified to support this in the future.
 - The ability to partition by key for documents and (key,id) for links and references lends itself to high performance fetches for documents from the database by not having to read across partitions.

For service implementation I went with:

 - Node
 - Express
 - DataStax cassandra-driver

These choices enabled me to build a service quickly that meets all the requirements.

# Data definition

Data in the Cassandra database is organized under the docservice keyspace with three tables:
### Documents
|key|id|html|
|--|--|--|
|Client specified key|Service assigned ID|Client provided HTML|
### Links
|key|id|linkid|title|uri|
|--|--|--|--|--|
|Client specified key|Service assigned ID|Client provided link-id|Client provided title|Client provided URI|
This table is partitioned by (key,id) for fast retrieval of all links for a specific document.
### References
|key|id|linkid|anchor|position|
|--|--|--|--|--|
|Client specified key|Service assigned ID|Client provided link-id|Client provided anchor|Client provided position|
This table is partitioned by (key,id) for fast retrieval of all references for a specific document.


# Additional functionality

This service will also register the docservice keyspace and tables if not already registered.

# API

**Title:** Store new document with [key]
**URL:** /docservice/[key]
**Method:** POST
**URL params:** None
**Data params:** JSON describing the document conforming to the assignment's model.
**Success response**: JSON with the given key and newly assigned ID for this document's version:
{
&nbsp;&nbsp;"key": "\<key>",
&nbsp;&nbsp;"id": "\<cassandra-timeuuid>"
}

**Title:** Get document (specific version)
**URL:** /docservice/[key]/[id]/html
**Method:** GET
**URL params:** None
**Success response**: JSON with the given key, ID, and the associated HTML for the document:
{
&nbsp;&nbsp;"key": "\<key>",
&nbsp;&nbsp;"id": "\<cassandra-timeuuid>"
&nbsp;&nbsp;"html": "\<your-document-html>"
}

**Title:** Get all documents for a given key
**URL:** /docservice/[key]/all/html
**Method:** GET
**URL params:** None
**Success response**: JSON with the given key and further chunked by each stored ID, and the associated HTML for that document
{
&nbsp;&nbsp;"key": "\<key>",
&nbsp;&nbsp;"docs": [
&nbsp;&nbsp;&nbsp;&nbsp;{
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": "\<your-document-html>"
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"html": "\<your-document-html>"
&nbsp;&nbsp;&nbsp;&nbsp;},
&nbsp;&nbsp;&nbsp;&nbsp;// ...
&nbsp;&nbsp;]
}

**Title:** Get links for a given specific document (key/id tuple)
**URL:** /docservice/[key]/[id]/html
**Method:** GET
**URL params:** None
**Success response**: JSON with the given key, id, and further chunked by each stored link:
{
&nbsp;&nbsp;"key": "\<key>",
&nbsp;&nbsp;"id": "\<cassandra-timeuuid>"
&nbsp;&nbsp;"links": [
&nbsp;&nbsp;&nbsp;&nbsp;{
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"id": \<int>,
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"title": "\<string>",
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"uri": "\<string>"
&nbsp;&nbsp;&nbsp;&nbsp;},
&nbsp;&nbsp;&nbsp;&nbsp;// ...
&nbsp;&nbsp;],
}

**Title:** Get referencesfor a given specific document (key/id tuple)
**URL:** /docservice/[key]/[id]/html
**Method:** GET
**URL params:** None
**Success response**: JSON with the given key, id, and further chunked by each stored reference:
{
&nbsp;&nbsp;"key": "\<key>",
&nbsp;&nbsp;"id": "\<cassandra-timeuuid>"
&nbsp;&nbsp;"references": [
&nbsp;&nbsp;&nbsp;&nbsp;{
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"anchor": "\<string>",
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"position": \<int>,
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"link": \<link-id>
&nbsp;&nbsp;&nbsp;&nbsp;},
&nbsp;&nbsp;&nbsp;&nbsp;// ...
&nbsp;&nbsp;],
}
