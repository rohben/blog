// Just a basic server setup for this site
var Stack = require('stack'),
    Creationix = require('creationix'),
    Http = require('http');

Http.createServer(Stack(
  Creationix.log(),
  require('wheat')(process.env.ROHBEN_LAB ? process.env.GITOLITE + "/blog" : __dirname +"/..")
)).listen(process.env.ROHBEN_LAB ? 80 : 8080);
