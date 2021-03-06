/*
 * A NodeJS Express Server to run the application in production with Universal Server-side rendering.
 * To execute the server, after the build, just perform "node crowd-pulse-web-ui-user.js".
 *
 * The content was created by following the tutorial at https://goo.gl/GjNFa2
 *
 * IMPORTANT: DO NOT MODIFY THIS FILE
 */
'use strict';

// server specific version of Zone.js
require('zone.js/dist/zone-node');

const express = require('express');
const ngUniversal = require('@nguniversal/express-engine');

// the server bundle is loaded here, it's why you don't want a changing hash in it
const appServer = require('./../dist-server/main.bundle');

// Server-side rendering
function angularRouter(req, res) {

  // server-side rendering
  res.render('index', { req, res });

}

const app = express();

// root route before static files, or it will serve a static index.html, without pre-rendering
app.get('/', angularRouter);

// serve the static files generated by the CLI (index.html, CSS, JS, assets...)
app.use(express.static(`${__dirname}/../dist`));

// configure Angular Express engine
app.engine('html', ngUniversal.ngExpressEngine({
  bootstrap: appServer.AppServerModuleNgFactory
}));
app.set('view engine', 'html');
app.set('views', '../dist');

// direct all routes to index.html, where Angular will take care of routing
app.get('*', angularRouter);

app.listen(9090, '0.0.0.0', () => {
  console.log('Listening on http://localhost:9090');
});
