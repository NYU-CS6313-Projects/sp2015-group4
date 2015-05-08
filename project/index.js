var http = require("http");
var mongojs = require("mongojs");
var JSONStream = require('JSONStream');
var express = require('express');
var url = require('url') ;
var fs = require('fs')
//var static = require('node-static');
//var ip = require("ip");
var async = require("async");
var outgoingRequest = require("request");
//var forEach = require('async-foreach').forEach;

var port = 8080;

var db = mongojs("meetup");

var members = db.collection('members');

//var fileServer = new static.Server("./index.html");

var app = express();

app.use(express.static('static'));


var limit = 10; // By default, but can be overridden with a param

app.all('/', allowAccessHeaders);
app.get("/", simpleHandler);

app.all("/listcatagories", allowAccessHeaders);
app.get("/listcatagories", listCatagoriesHandler);

app.all("/catagory/*", allowAccessHeaders);
app.get("/catagory/*", catagoryHandler);

app.all("/viz/*", allowAccessHeaders);
app.get("/viz/*", fileHandler);

app.all("/groups/*", allowAccessHeaders);
app.get("/groups/*", groupsHandler);

function groupsHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
	
	if(request.query.startTime) {
		startTime = new Date(request.query.startTime);
		//console.log(startTime);
	} else {
		startTime = new Date(2009, 04, 01);
	}
	if(request.query.endTime) {
		endTime = new Date(request.query.endTime);
	} else {
		endTime = new Date(2011, 04, 01);
	}
	var headCountLess = 10;
	if(request.query.headCountLess)
		headCountLess = request.query.headCountLess;
	var headCountMore = 30;
	if(request.query.headCountMore)
		headCountMore = request.query.headCountMore;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	/*
{
    headcount: {$gt: 10, $lt: 30}
    ,
    visibility: {$eq: "public"}
    ,
    //time: {$lt: end}
    time: 
    {
        $gt: 1238544000000,
        $lt: 1240876800000
        }
        
}
	*/
	
	//startTime = new Date(2009, 04, 01).getTime();
	//endTime = new Date(2015, 04, 01).getTime();
	
	//console.log("startTime: " + startTime.getTime());
	//console.log("endTime: " + endTime.getTime());
	
	db.collection('events').find(
	{
	time:
		{
			$gt: startTime.getTime(),
			$lt: endTime.getTime()
			//$gt: new Date(2009, 04, 01).getTime(),
			//$lt: new Date(2015, 04, 01).getTime()
			//$gt: new Date(1238544000000).getTime()
			//$gt: 1238544000000,
			//$lt: new Date(2012, 7, 14)
			},
	headcount:
		{
			$lt: headCountMore
		}
	},
	{limit: limit},
		function(err, data) {
		if(err) {
			console.log("ERROR");
			console.log(err);
			return;
		}
		var output = "";
		//output += "First five users who's join date is after " + new Date(1377699498000) + "";
		
		output += JSON.stringify(data);
		
		response.write(output);
		
		response.end();
	});

}

function fileHandler(request, response) {
	console.log("Found file");
	fs.readFile("./index.html", "utf8", function(err, file) {
		console.log("Reading file...");
		response.writeHead(200, {"Content-Type": "text/html"});
		if(err) {
			console.log("ERROR");
			console.log(err);
			response.write("ERROR");
			response.end();
			return;
		}
		response.write(file, "utf8");
		response.end();
	});
	return;
}

app.all("/meetup1.json", allowAccessHeaders);
 
function allowAccessHeaders(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
}


app.all("/meetup1.json", allowAccessHeaders);
app.get("/meetup1.json", tempHandler);

function tempHandler(request, response) {
	console.log("Found file");
	fs.readFile("./meetup1.json", "utf8", function(err, file) {
		console.log("Reading file...");
		response.writeHead(200, {"Content-Type": "application/json", "charset": "utf-8"});
		if(err) {
			console.log("ERROR");
			console.log(err);
			response.write("ERROR");
			response.end();
			return;
		}
		response.write(file, "utf8");
		response.end();
	});
	return;
}

function listCatagoriesHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
	
	response.writeHead(200, {"Content-Type": "application/json"});
	
	db.collection('catagory').distinct('category.shortname', function(err, data) {
		if(err) {
			console.log(err);
			return;
		}
		var output = "";
		output += JSON.stringify(data);
		response.write(JSON.stringify(data));
		//response.write(output);
		response.end();
	});
}

/*
Trying to implement this:
SO ANNOYING.
This is all I want:
var myCursor = db.getCollection('catagory').distinct('category.shortname')
 
var output = [];
 
myCursor.forEach(
    function(myDoc) {
        var result = db.getCollection('catagory').find({"category.shortname" : myDoc });
        output.push([myDoc, result.count()]);
    }
);
printjson(output);


*/

// TODO orrrr, I could just not do it this way, and do it simpler like.
// THat's possible, too

function catagoryHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	// It's much more useful in this form
	var path = request.path.split("/");
	
	
	if(path[2] == '') {
		
		db.collection('catagory').distinct('category.shortname', function(err, data) {
			if(err) {
				console.log(err);
				return;
			}
			if(request.query.details) {
				var output = [];
				
				//https://github.com/caolan/async#forEach
				// We can always re-order in allDone() if need be.
				// eachSeries is guaranteed to be in order, but is not as safe
				
				//async.eachSeries(data, function(item, callback) {
				async.each(data, function(item, callback) {
					db.collection('catagory').count({"category.shortname": item},
						function(err, data) {
							output.push([item, data]);
							callback();
						})

				} ,function(err) {
					response.write(JSON.stringify(output));
					response.end();
				})
				
				/*
				function allDone(notAborted, arr) {
					console.log("done", notAborted, arr);
				}
				
				forEach(data, function(item, index, arr) {
					//console.log("Item: " + item);
					db.collection('catagory').count({"category.shortname": item},
						function(err, data) {
							output.push([item, data]);
							//console.log(output);
							console.log(test++);
						})
				}, allDone)
				*/
				
				/*function(notAborted, arr) {
					console.log("All done");
					console.log(test);
					console.log(JSON.stringify(output));
					response.write(JSON.stringify(output));
					response.end();
				})*/
				
				/*
				//console.log("Details requested...");
				data.forEach(function(d, i) {
					//console.log("http://104.237.146.70:8124/catagory/"+d);
					
					outgoingRequest('http://104.237.146.70:8124/catagory/'+d, function (error, response, body) {	
						if (!error && response.statusCode == 200) {
							var info = JSON.parse(body);
							console.log("Data: " + d + " " + info);
						}
					})
					
				})
				*/
			} else {
				
				
				response.write(JSON.stringify(data));
				response.end();
				return;
			}
		})
	
	
	
	} else {
		db.collection('catagory').count({"category.shortname": path[2]}, function(err, data) {
			console.log(data);
			response.write(JSON.stringify(data));
			response.end();
		});
	}
	
	
	
	//response.write("Out: ");
	//response.write(output);
	//response.end();

}

function simpleHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	db.collection('members').find({joined:{$gt:1377699498000}}, {limit: limit}, function(err, data) {
		var output = "";
		//output += "First five users who's join date is after " + new Date(1377699498000) + "";
		
		output += JSON.stringify(data);
		
		response.write(output);
		
		response.end();
	});

}

var server = app.listen(port);
console.log("Server running at http://" + server.address().address + ":" + server.address().port);