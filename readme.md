#Usage


```js
//es6
import Relay from 'realy';

var schema = {
   comments: {
       get: {
         path: '/comments',
         // parse is optional, function or array or functions
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
    parse: [] // or function or what ever passed in schema
   } 
*/
relay.on('beforeRequest', function(options, request){

});

relay.on('request', function(options, request){

});

relay.on('response', function(options, request, response){

});

relay.on('error', function(options, request, response, error){

});

relay.on('requestsFinish', function(){

});

```


#Api Methods

Api methods returns promises, you can also pass node style callback. Methods are available as lower cased + concatenated(resouceName_methodName) 


```js

//with out data 1
var promise = relay.api.comments_get();

//or callback
relay.api.comments_get(function(err, res){
}); 

//with out data 2
var request = relay.api.comments_get(false);
var promise = request.end(); // similar to superagent's api

//or callback
request.end(function(err, res){
});


//with data 1
var promise = relay.api.comments_get({count:3});

//or callback
relay.api.comments_get({count:3},function(err, res){
});

//with data 2
var request = realy.api.comments_get({count:3}, false);
var promise = request.end(); // similar to superagent's api

//or callback
request.end(function(err, res){
});

```
 




# run gulp default task if needed
gulp default
