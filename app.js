/**
	USER COORDINATES API
**/

//http-api
const express = require('express');
const bodyParser = require('body-parser');
const routeValidator = require('express-route-validator');

//Logging
const morgan = require('morgan');
const winston = require("winston");
const level = process.env.LOG_LEVEL || 'debug';
const logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            level: level,
            timestamp: function () {
                return (new Date()).toISOString();
            }
        })
    ]
});
// Database
const MONGO_PORT = process.env.MONGO_PORT || 27017; // redis port
const MONGO_HOST = process.env.MONGO_HOST || "localhost"; // redis host
const mongo = require('mongodb');
const monk = require('monk');
const db = monk(`${MONGO_HOST}:${MONGO_PORT}/jodel`,(err)=>{
  if(err !== null){
    throw(err);
  }
});
//Redis
const redis = require('redis');
const REDIS_PORT = process.env.REDIS_PORT || 6379; // redis port
const REDIS_HOST = process.env.REDIS_HOST || "localhost"; // redis host
const CACHE_TIMEOUT = process.env.CACHE_TIMEOUT || 5; // timeout of cache in secoonds
const redisClient = redis.createClient(REDIS_PORT,REDIS_HOST);
redisClient.on("error",(err)=>{
  if(err !== null){
    throw(err); 
  }
});

//Routes, HERE just for easy readability, they should be in their own file
const router = express.Router();

/*
 * Save user coordinates
 * POST
 * USAGE: curl --header "Content-Type: application/json" --data '{"latitude": 42.1,"longitude":44.3}' -X POST http://127.0.0.1:3000/user/1/coordinates
 */
const addCoordValidator = routeValidator.validate({
  params: {
    id: { isRequired: true, isInt: true }
  },
  body: {
    latitude: { isRequired: true, isFloat: true },
    longitude: { isRequired: true, isFloat: true },
  },
  headers: {
    'content-type': { isRequired: true, equals: 'application/json' }
  }
});

router.post('/user/:id/coordinates',addCoordValidator,(req, res, next) => {
  let c = {
		userID:req.params.id,
    latitude:req.body.latitude,
    longitude:req.body.longitude,
    updated_at: new Date().getTime()
	};
  let collection = req.db.get('coordinates');
  collection.insert(c).then((result)=>{
    logger.debug('coord added');
    res.send("OK");
  }).catch((err)=>{
    next(err);
  });
});

/*
 *  Get all coordinates filtered by USER ID, with 20 results per page,
    ordered by the most recent
    USAGE : curl http://127.0.0.1:3000/user/1/coordinates\?page\=1
 */
const PAGE_RESULTS = 1;
const getCoordValidator = routeValidator.validate({
  params: {
    id:{isRequired:true,isInt:true}
  },
  query:{
    page:{isRequired:true,isInt:{min:1}}
  }
});
//simple cache
const cache = (req, res,next)=>{
  //check if no_cache set
  if(req.query.no_cache !== undefined){
    logger.debug('no_cache mode');
    next();
    return;
  }

  req.cache.get(req.originalUrl,(err,value)=>{
    if(err !== null){
      throw err;
    }
    if(value !== null){
      logger.debug('req served from cache', {key: req.originalUrl});
      res.json(JSON.parse(value));
    } else {
      next();
    }
  });
};

router.get('/user/:id/coordinates',getCoordValidator, cache, (req, res, next) => {
  
  let skipN = (req.query.page !== undefined)?(req.query.page-1) * req.pagination : 0;
  let collection = req.db.get('coordinates');
  collection.find({userID:req.params.id},{limit:req.pagination,skip:skipN,sort:{"updated_at":-1}}).then((result)=>{
      //add_to_cache_if_no_key
      req.cache.set([req.originalUrl, JSON.stringify(result),"NX","EX", CACHE_TIMEOUT],(err)=>{
        if(err !== null){
          throw err;
        }
      });
      logger.debug('req served from DATABASE',{key: req.originalUrl});
      res.json(result);
  }).catch((err)=>{
    next(err);
  });
});

//App
const app = express();

// Make db local to request
app.use((req,res,next) => {
    req.db = db;
    req.cache = redisClient;
    req.pagination = PAGE_RESULTS;
    next();
});

//Logging middleware exclude test 
if(process.env.NODE_ENV !== "test"){
  app.use(morgan('dev', {
      skip: function (req, res) {
          return res.statusCode < 400
      }, stream: process.stderr
  }));

  app.use(morgan('dev', {
      skip: function (req, res) {
          return res.statusCode >= 400
      }, stream: process.stdout
  }));  
}

app.use(bodyParser.json());
app.use('/', router);


//Error handler middlleware
app.use((err, req, res, next) => {
  console.error("[ERROR]",err.stack);
  res.status(err.status || 500).send({err:err.message});
});

app.set('port', process.env.PORT || 3000);

// so app can be also imported without opening socket
if(module.parent === null){
  let server = app.listen(app.get('port'), () => {
    console.log('Express server listening on port ' + server.address().port);
  });  
}

module.exports = {app:app,redisClient:redisClient,db:db,pagination:PAGE_RESULTS};