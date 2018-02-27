
process.env.CACHE_TIMEOUT = 1; //for testing cache expire
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "fatal";

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app').app;
const redisClient = require('../app').redisClient;
const db = require('../app').db;
const assert = require("assert");
const asyncP = require("async-promises");

var expect = chai.expect;
chai.use(chaiHttp);
/* jshint ignore:start */
const postCoordinate = async (payload)=>{
  return chai.request(app)
    .post('/user/0/coordinates')
    .set("Content-Type", "application/json")
    .send(payload).then((res)=> {
      expect(res).to.have.status(200);
    }).catch((err)=> {
      throw err;
    });
};
const getCoordinates = async (query) =>{
  return chai.request(app)
    .get(`/user/0/coordinates?${query}`)
    .then((res)=> {
      expect(res).to.have.status(200);
      return res;
    }).catch((err)=> {
      throw err;
    });
};

const timeout = async (s)=> {
  return new Promise(resolve => setTimeout(resolve, s*1000));
}
/* jshint ignore:end */
describe('App', function() {
  beforeEach((done)=> {
    
    //flush redis
    redisClient.flushall((err,result)=>{
      if(err) throw err;
      // flush mongo db
      db._db.dropDatabase((err, result)=>{
        if(err) throw err;
        done();
      }); 
    });

  });
  //POST COORDINATE
  describe('POST: /user/0/coordinates', () =>{
    it('Responds with status 200', async ()=> {
      await postCoordinate({"latitude":42.1,"longitude":42.3})
    });
    it('Responds with status 400 when no payload', async ()=> {
      await postCoordinate({"foo":"bar"}).catch((res)=>{
         expect(res).to.have.status(400);
      })
    });
  });
  //GET COORDINATES FROM DATABASE
  describe('GET FROM DB: /user/0/coordinates?page=1', ()=> {
    it('Responds with status 200 and correct results ', async () => {
        let c = {"latitude":42.1,"longitude":42.1}
        await postCoordinate(c);
        await getCoordinates("page=1&no_cache").then((res)=>{
          assert.equal(c.latitude,res.body[0].latitude);
          assert.equal(c.longitude,res.body[0].longitude);
        })
    });
    it('Responds with status 400 on wrong query ', async () => {
        await getCoordinates("").catch((res)=>{
          expect(res).to.have.status(400);
        })
    });
  });

  //RESULTS PAGINATION
  describe('PAGINATION ON: /user/0/coordinates', ()=> {
    it('Responds with status 200 and correct results ', async () => {
        //lets push results to fill one page and have one result on second page
        let pageResults = require("../app").pagination;
        let entries = pageResults + 1; //make 2 pages
        let c = {"latitude":42.1,"longitude":42.1};
        let results=[];
        for (var i = entries - 1; i >= 0; i--) {
          results.push(c);
        }
        await asyncP.each(results,postCoordinate);
        await getCoordinates("page=1&no_cache").then((res)=>{
          assert.equal(res.body.length,pageResults);
        })
        await getCoordinates("page=2&no_cache").then((res)=>{
          assert.equal(res.body.length,1);
        })
    });
  });

  //GET COORDINATES FROM CACHE
  describe('GET FROM CACHE: /user/0/coordinates?page=1', ()=> {
    it('Responds with status 200 and correct results ', async () => {
      let c1 = {"latitude":42.1,"longitude":42.1};
      let c2 = {"latitude":42.2,"longitude":42.2};
      //post 
      await postCoordinate(c1);
      //set up cache
      await getCoordinates("page=1");
      //post
      await postCoordinate(c2);
      //check results return still c1 and not c2
      await getCoordinates("page=1").then((res)=>{
        assert.equal(c1.latitude,res.body[0].latitude);
      })
    })
  })
  //SET UP CACHE AND WAIT FOR IT TO EXPIRE
  describe('GET FROM CACHE EXPIRED : /user/0/coordinates?page=1', ()=> {
    it('Responds with status 200 and correct results ', async () => {
      let c1 = {"latitude":42.1,"longitude":42.1};
      let c2 = {"latitude":42.2,"longitude":42.2};
      //post 
      await postCoordinate(c1);
      //set up cache
      await getCoordinates("page=1");
      //post
      await postCoordinate(c2);
      //wait for cache to expire
      await timeout(process.env.CACHE_TIMEOUT);
      //check results return now c2 and not c1
      await getCoordinates("page=1").then((res)=>{
        assert.equal(c2.latitude,res.body[0].latitude);
      })
    })
  })
});