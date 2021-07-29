const dotenv = require('dotenv');
const AWS = require('aws-sdk');
const unsplash = require('unsplash-js');
const nodeFetch = require('node-fetch');
const request = require('request');



exports.handler = async (event, context) => {
    try {
        var statusCode = await handle();
        response = {
            'statusCode': statusCode,
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};

async function handle() {
    // TODO, programattically add the env variables to the template.yaml

    if (process.env.NODE_ENV !== 'production') {
        dotenv.config();
    }

    if(!(process.env.UNSPLASH_ACCESS_KEY)){
        throw new Error("Needed env var UNSPLASH_ACCESS_KEY, but was not present");
    }

    if(!(process.env.S3_REGION)){
        throw new Error("Needed env var S3_REGION, but was not present");
    }

    const REGION = process.env.S3_REGION;
    AWS.config.update({region: REGION});
    const s3 = new AWS.S3({apiVersion: '2006-03-01'});


    const unsplashClient = unsplash.createApi({
        accessKey: process.env.UNSPLASH_ACCESS_KEY,
        fetch: nodeFetch,
    })

    const unsplashPageMark = await getUnsplashPageMarker(s3);
    console.log("Retrieved the unsplash page marker: " + unsplashPageMark.toString());

    await unsplashClient.photos.list({page: unsplashPageMark.page, perPage: unsplashPageMark.perPage, orderBy: unsplashPageMark.orderBy})
        .then(async (result) => {
            if (result.errors) {
                console.log('Error occurred when listing photos from unsplash: ', result.errors[0]);
            } else {
                console.log(`Request status code from listing photos fro Unsplash: ${result.status}`);
            
                const photos = result.response.results;

                await Promise.all(photos.map(async (photo) => {
                    const url = photo.urls.raw;
                    const key = photo.id + ".jpg";
                    await uploadToS3(url, s3, key);
                }));
                console.log("Successfully waited")

                // photos.forEach(async (photo) =>  {
                //     const url = photo.urls.raw;
                //     const key = photo.id + ".jpg";
                //     var d = await uploadToS3(url, s3, key);
        
                // });
            }
      });

    unsplashPageMark.page++;

    await putUnsplashPageMarker(s3, unsplashPageMark);

    return 200;
    
}

async function getUnsplashPageMarker (s3) {
    try {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: "unsplash_page_counter.json",
      }
  
      const data = await s3.getObject(params).promise();
  
      return JSON.parse(data.Body.toString('utf-8'));
    } catch (e) {
      throw new Error(`Could not retrieve file from S3: ${e.message}`)
    }
}

async function uploadToS3(uri, s3, key) {

    console.log("Attempting to upload photo at " + uri + " to " + key);
  
    var options = {
      uri: uri,
      encoding: null
    };
  
    var params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    };
  
    return new Promise(function(resolve, reject) { 
        request(options, async function(error, response, body) {
            if (error || response.statusCode !== 200) { 
                console.log("Failed to get image at " + options.uri);
                console.log(error);
                reject(error);
            } else {
                console.log("Successfully downloaded image @ uri: " + uri);

                var s3HeadResponse;

                try {
                    s3HeadResponse = await s3.headObject(params).promise();
                    console.log("File exists in bucket in s3, not uploading " + key);
                } catch(error) {
                    console.log("The head respponse is caught in a try/catch");
                    // console.log(error);
                    if (error) {  
                        if (error.code === 'NotFound') {
                            try {

                                var s3Response = await s3.putObject({
                                    Body: body,
                                    Key: key.toString(),
                                    Bucket: process.env.S3_BUCKET_NAME}).promise();
                                console.log("Success uploading to s3: " + key );

                            } catch (err) {
                                console.log("Error uploading image to s3: " + key);
                                console.log(err);
                                reject(err);
                            }
                        } else {
                            console.log("Error getting head metadata on key: " + key);
                            reject(error);
                        }
                    }
                } 


                resolve(body);         
            }   
        });
    });   
}

async function putUnsplashPageMarker(s3, unsplashPageMarker) {
    try {
      var key = "unsplash_page_counter.json";
      s3.putObject({
        Body: JSON.stringify(unsplashPageMarker),
        Key: key,
        Bucket: process.env.S3_BUCKET_NAME
      }, function(error, data) {
        if (error) {
          console.log("Error uploading image to s3: " + key);
          console.log(error);
        } else {
          console.log("Success uploading to s3: " + key );
        }
      });
    } catch (e) {
      throw new Error(`Could not upload file from S3: ${e.message}`)
    }
} 