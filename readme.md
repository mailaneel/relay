#Usage


```js
//es6
import Relay from 'relay';

var schema = {
   comments: {
       get: {
         path: '/comments',
         // parse is optional
         parse: function(res){
          return res.map(comment => comment + '!!')
         },
         method: 'GET', // optional defaults to GET  
         
      } 
   }
}


var config = {
   apiUrl: 'http://test.com'
}

var relay = Relay.fromSchema(schema, config);
var api = relay.api;

```

#Plugins

```js

//handler function is called once
//superagent level
Relay.use(function(superagent){

});


//or after creating relay instance
// handler function is called for each request
// 
relay.use(function(request){
  //set accept header
  request.accept('json')
});


```

#Available Events

Relay extends from EventEmitter, so you can use nodes event api to listen for events

* beforeRequest: here requests can be modified
* request: take this as a opportunity to abort requests if needed 
* response 
* error
* requestsFinish: this is fired when there are 0 pending requests


```js

/*
options = {
    resourceName: 'comments',
    methodName: 'get',
    path: '/comments',
    parse: null 
   } 
*/
relay.on('beforeRequest', function(request){

});

relay.on('request', function(request){

});

relay.on('response', function(request, response){

});

relay.on('error', function(error, request, response){

});

relay.on('requestsFinish', function(){

});

```


#Api Methods

Api methods returns promises, you can also pass node style callback. Methods are available as lower cased + concatenated(resouceName_methodName) 


```js

//with out data 1
var promise = api.comments.get();

//or callback
api.comments.get(function(err, comments, res){
}); 

//with out data 2
var request = api.comments.get(false);
var promise = request.end(); // similar to superagent's api

//or callback
request.end(function(err, comments, res){
});


//with data 1
var promise = api.comments.get({count:3}).then(function(comments, res){});

//or callback
api.comments.get({count:3},function(err, comments, res){
});

//with data 2
var request = api.comments.get({count:3}, false);
var promise = request.end(); // similar to superagent's api

//or callback
request.end(function(err, comments, res){
});

```
 




# run gulp default task if needed
gulp default
