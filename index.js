"use strict";

var async = require("async");
var ID3 = require("id3-parser");
var AWS = require("aws-sdk");

var S3 = new AWS.S3();
var dynamoDB = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function preprocessName(origName)
{
    var processedName = "";
    origName = origName.toLowerCase();
    
    console.log("Name is " + origName);
    
    if (origName.match(/^the\s/))
    {
        origName = origName.substring(3);
    }
    
    // Replace ampersand with 'and' and numbers with spellings
    origName = origName.replace( /\s&\s/g, "and" );
    
    console.log("After replace name is " + origName);
    origName = origName.replace( /^first|\sfirst/g, "1st" );
    origName = origName.replace( /^third|\sthird/g, "3rd" );
    origName = origName.replace( /^fourth|\sfourth/g, "4th" );
    origName = origName.replace( /^fifth|\sfifth/g, "5th" );
    origName = origName.replace( /^sixth|\ssixth/g, "6th" );
    origName = origName.replace( /^seventh|\sseventh/g, "7th" );
    origName = origName.replace( /^eighth|\seighth/g, "8th" );    
    
    for ( var i = 0; i < origName.length; i++ )
    {
        var charStr = origName.charAt(i);
        var pattern = /[a-z0-9]/;
        if( charStr.match(pattern) !== null )
        {
            processedName = processedName.concat(origName.charAt(i));            
        }
    }
    
    if(processedName.length === 0)
    {
        processedName = "Unknown";
    }
    
    return processedName;
}

exports.handler = function(event, context, callback){
      
    var srcBucket = event.Records[0].s3.bucket.name;
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    var s3url = "https://s3.amazonaws.com/" + srcBucket + "/" + event.Records[0].s3.object.key.replace(/\s/g, '+');

    S3.getObject( { 
                    Bucket: srcBucket,
                    Key: srcKey
    },
    function (err, response) {

    ID3.parse(response.Body).then( function (tag) {
        
        var trackPattern = new RegExp("[0-9]+");
        
        var title = preprocessName(tag.title);
        var artist = preprocessName(tag.artist);
        var album = preprocessName(tag.album);
        var trackNum = trackPattern.exec(tag.track)[0];
               
        var songTableParams = {
            TableName: process.env.DYNAMODB_MUSIC_TRACK_TABLE,
            Item: {
                "title": title,
                "artist": artist,
                "album": album,
                "trackNumber": trackNum,
                "ui_title": tag.title,
                "ui_artist": tag.artist,
                "ui_album": tag.album,
                "url": s3url
            }
        };
        
        docClient.put( songTableParams, function(err, data) {
            if (err)
                console.log(JSON.stringify(err, null, 2));
            else
                console.log(JSON.stringify(data, null, 2));
        } );
        
        var albumTableParams = {
            TableName: process.env.DYNAMODB_MUSIC_ALBUM_TABLE,
            Key: {
                "album": album,
                "artist": artist
            },
            UpdateExpression: "SET ui_artist = :uiartist, ui_album = :uialbum, tracks = list_append( if_not_exists(tracks, :empty_list), :i)",
            ExpressionAttributeValues: {
                ":uiartist": tag.artist,
                ":uialbum": tag.album,
                ":i": [ { title: title, ui_title: tag.title, trackNumber: trackNum, url: s3url } ],
                ":empty_list": []
            }
        };
        
        docClient.update( albumTableParams, function(err, data) {
            if (err)
                console.log(JSON.stringify(err, null, 2));
            else
                console.log(JSON.stringify(data, null, 2));
        } );
        
        
        var artistTableParams = {
            TableName: process.env.DYNAMODB_MUSIC_ARTIST_TABLE,
            Item: {
                "artist": artist,
                "title": title,
                "album": album,
                "ui_artist": tag.artist,
                "ui_album": tag.album,
                "ui_title": tag.title,
                "trackNumber": trackNum,
                "url": s3url
            }
        };
        
        docClient.put( artistTableParams, function(err, data) {
            if (err)
                console.log(JSON.stringify(err, null, 2));
            else
                console.log(JSON.stringify(data, null, 2));
        } );
        
    } );
} );

}
