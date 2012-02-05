// Just a basic server setup for this site
var Stack = require('stack'),
    Creationix = require('creationix'),
    Http = require('http');

var server = Http.createServer(Stack(
  Creationix.log(),
  require('wheat')(process.env.PRODUCTION ? process.env.NODE_ROOT_DIR + "/blog.rohben.com" : __dirname +"/..")
));

var port = process.env.PRODUCTION ? 80 : 8080;

console.log("blog.rohben.com on port " + port);

server.listen(port);
