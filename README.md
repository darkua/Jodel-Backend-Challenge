# Backend Code Challenge

A simple app in express using mongo as data storage and redis as memory cache, for storing and retriving user geo coordinates.

## Install && Run

Get all code dependencies for the project
`npm install`

Start Redis and Mongo services
`docker-compose up`

Start app
`npm run start`


## Testing

Inside test directory you will find the end-to-end test, just run

`npm run test`

## Extra
How about a simple client demo to use the api? since we are posting coordinates, it could be cool to see them on a map, so i made also some golang code (ab.go) in order to push coordinates to our server of random walking routes in berlin, kreuzberg, so it simulates jodels going for a walk. Lets dockerize everything so we can run it all together!

Lets create an image for our app

`docker build -t jodel_app .`

And go to directory ab, and if you lets build an image for ab also

`cd ab`
`docker build -t ab_app .`


Now lets compose the demo

docker-compose -f docker-compose-demo.yaml up

if you now go to 

`http://localhost:3000`

you should see 5 jodels going for a walk, just like the picture:

![jode_demo](./ab/jodel_demo.png)

## Extra & Cache

The example is using polling to get results, from a endpoint that was more tought for some like the most recent something where there are much more gets then posts, it a normal world we would use websockets to push the results to client with pubsub redis or any other message queue system, but in order to illustrate the cache on the current system just activate the request to not skip cache, and you should see the jodels moving only according to cache timeout, 5s

`http://localhost:3000/?cache`






