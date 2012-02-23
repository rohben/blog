// Just a basic server setup for this site
var util = require('util'),
    stack = require('stack'),
    creationix = require('creationix'),
    http = require('http'),
    colors = require('colors'),
    cluster = require('cluster');

/**
 * Table of command line options. */
var options = [{
    option   : '-p, --port <number>',
    usage    : 'Port number to listen on.',
    default  : '8001'
}, {
    option   : '-u, --user <name>',
    usage    : 'User to switch to after binding to the port. Only required if binding to port less than 1024.'
}, {
    option   : '-w, --workers [count]',
    usage    : 'Number of worker threads.',
    default  : '1'
}];

/**
 * Command line help. */
var usage = '\
Node.js application to serve a git-based blog.\
';

/**
 * Current version of this application. */
var version = "1.0.0";

/**
 * Helper function to print error messages.
 *
 * @param[in] msg
 *     The error message.
 */
var app_error = function(msg, no_exit) {
    process.stderr.write('ERROR: '.red);
    process.stderr.write(msg + '\n');
    if (!no_exit) {
        app_exit(1);
    }
};

/**
 * Helper function to print status messages.
 *
 * @param[in] msg
 *     The message to print.
 */
var app_info = function(msg) {
    process.stderr.write('INFO : '.green);
    process.stderr.write(msg + '\n');
};

/**
 * Helper function to print the status of this application.
 */
var app_status = function() {

    util.puts('\nWheat blog listening on port ' + args.port.toString().yellow);
};

/**
 * HTTP server. Will only be valid for workers. */
var server;

/**
 * Total number of workers online. */
var worker_count = 0;

/**
 * A hash of all known workers, indexed by the worker's PID. */
var workers = {};

/**
 * Start a single worker. This function should only be called from the
 * master. */
var worker_start = function() {

    var worker = cluster.fork();

    workers[worker.pid] = worker;

    worker.on('message', function(msg) {
        if (msg.cmd == 'ready') {
            worker_count++;
            app_info("Worker " + worker_count +
                     " of " + args.workers +
                     " online.");
            if (worker_count == args.workers) {
                /* Print information about the proxy server. */
                app_status();

                /* Drop privileges. */
                if (args.user ) {
                    process.setuid(args.user);
                }
            }
        }
    });
};

/**
 * Start the application. This function can be called from the master or
 * worker.
 *
 * @pre
 *     Global 'args' has been initialised.
 */
var app_start = function() {

    if ((args.workers > 1) && (cluster.isMaster)) {
        for (var i = 0; i < args.workers; i++) {
            worker_start();
        }

        cluster.on('death', function(worker) {
            app_error('Worker ' + worker.pid + ' died.', 1);
            delete workers[worker.pid];
            worker_count--;
            worker_start();
        });

    } else {
        /* This is either a worker, or the application has been configured to
         * run without workers. Start the blog server. */
        var server = http.createServer(stack(
            creationix.log(),
            require('wheat')(__dirname +"/..")
        ));        

        server.on('error', function(error) {
            if ((args.port < 1024) && (error.code == 'EACCES')) {
                app_error('Administrator privileges required for port ' + args.port);
            } else {
                app_error(error);
            }
        });

        server.listen(args.port, function() {
            if (args.user) {
                /* Drop privileges. */
                process.setuid(args.user);
            }
            if (args.workers <= 1) {
                /* There are no workers (the master is the proxy), print
                 * some useful information about the proxy server. */
                app_status();
            } else {
                /* Let the master know the proxy server is up and
                 * running. */
                process.send({ cmd: 'ready' });
            }
        });
    }
};

/**
 * Function to free resources, and (in the case of the master) terminate all
 * child workers (which aren't automatically terminated when the parent
 * process dies).
 *
 * @param[in] status
 *     Status code to exit with. 0 for success, non-zer for error.
 * @param[in] signal
 *     An optional string which describes the OS signal which caused the
 *     application to terminate.
 */
var app_exit = function(status, signal) {
    if (server) {
        server.close();
        server = undefined;
    }
    if (cluster.isMaster) {
        console.log("");
        /* Kill all child workers. */
        for (var pid in workers) {
            if (!workers.hasOwnProperty(pid)) {
                continue;
            }
            app_info("Kill child " + pid);
            process.kill(pid);
        }
        if (signal) {
            signal = " (" + signal + ")";
        } else {
            signal = "";
        }

        app_info("Exit" + signal + " with status " + status);
    }

    process.exit(status);
};

/* Catch signals to clean up resources and for workers to be explicitly
 * terminated (they won't die automatically when the parent dies). */
process.on("SIGKILL", function() { app_exit(0, "SIGKILL"); });
process.on("SIGTERM", function() { app_exit(0, "SIGTERM"); });
process.on("SIGINT", function() { app_exit(0, "SIGINT"); });

/* Parse command line arguments. */
var args = require('./args').parse(version, usage, options, process.argv);

/* Argument check. */
if ((args.port < 1024) && (!args.user)) {
    /* If running on a privileged port a user must be specified so the
     * application can drop to that user after opening the port. */
    app_error('User must be specified for port ' + args.port + ' (see --user).');
    process.exit(1); 
}

app_start();
