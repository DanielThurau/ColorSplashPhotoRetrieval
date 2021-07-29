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
    verifyEnvironment();

    const REGION = process.env.S3_REGION;
    AWS.config.update({region: REGION});
    const s3 = new AWS.S3({apiVersion: '2006-03-01'});

    const unsplashPageMark = await getUnsplashPageMarker(s3);
    console.log("Retrieved the unsplash page marker: " + JSON.stringify(unsplashPageMark));

    var estimatedBucketSize = unsplashPageMark.page * unsplashPageMark.perPage;
    if (estimatedBucketSize > 1000) {
        console.log("Activating Safegaurd for number of objects within S3. Estimated Size: " + estimatedBucketSize + ". Safegaurd: 1000.");
        return 500;
    }

    await retrievePhotos(s3, unsplashPageMark);

    unsplashPageMark.page++;

    await putUnsplashPageMarker(s3, unsplashPageMark);

    return 200;
    
}

async function retrievePhotos(s3, unsplashPageMark) {
    const unsplashClient = unsplash.createApi({
        accessKey: process.env.UNSPLASH_ACCESS_KEY,
        fetch: nodeFetch,
    });

    await unsplashClient.photos.list({page: unsplashPageMark.page, perPage: unsplashPageMark.perPage, orderBy: unsplashPageMark.orderBy})
        .then(async (result) => {
            if (result.errors) {
                console.log('Error occurred when listing photos from unsplash: ', result.errors[0]);
                throw new Error (result.error[0]);
            } else {
                console.log(`Status code from listing photos fro Unsplash: ${result.status}`);
            
                const photos = result.response.results;

                await Promise.all(photos.map(async (photo) => {
                    const url = photo.urls.raw;
                    const key = photo.id + ".jpg";
                    await transferToS3(url, s3, key);
                }));
            }
      });
}

function verifyEnvironment() {
    if (process.env.NODE_ENV !== 'production') {
        dotenv.config();
    }

    if(!(process.env.UNSPLASH_ACCESS_KEY)){
        throw new Error("Needed env var UNSPLASH_ACCESS_KEY, but was not present");
    }

    if(!(process.env.S3_REGION)){
        throw new Error("Needed env var S3_REGION, but was not present");
    }

    if(!(process.env.UNSPLASH_PAGE_MARKER_KEY)) {
        throw new Error("Needed env var UNSPLASH_PAGE_MARKER_KEY, but was not present");

    }
}


async function getUnsplashPageMarker (s3) {
    try {
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: process.env.UNSPLASH_PAGE_MARKER_KEY,
        }
  
        const data = await s3.getObject(params).promise();
        const formattedData = JSON.parse(data.Body.toString('utf-8'));
        
        if (formattedData.page && formattedData.perPage && formattedData.orderBy) {
            return formattedData;
        } else {
            throw new Error("The Unsplash Page Marker is missing critical data: " + formattedData.toString());
        }
    } catch (e) {
        throw new Error(`Could not retrieve file from S3: ${e.message}`)
    }
}

async function transferToS3(uri, s3, key) {

    console.log("Attempting to upload photo at " + uri + " to " + key);
  
    var options = {
      uri: uri,
      encoding: null
    };
  
    return new Promise(function(resolve, reject) { 
        request(options, async function(error, response, body) {
            if (error || response.statusCode !== 200) { 
                console.log("Failed to get image at " + options.uri);
                console.log(error);
                reject(error);
            } else {
                
                var keyExists;
                try {
                    keyExists = await checkIfObjectExists(s3, process.env.S3_BUCKET_NAME, key);
                } catch (err) {
                    reject(err);
                }
               
                if (!keyExists) {  
                    try {
                        await s3.putObject({
                            Body: body,
                            Key: key.toString(),
                            Bucket: process.env.S3_BUCKET_NAME}).promise();
                        console.log("Success uploading to s3: " + key );

                    } catch (err) {
                        console.log("Error uploading image to s3: " + key);
                        console.log(err);
                        reject(err);
                    }
                }
                resolve(body);         
            }   
        });
    });   
}

async function checkIfObjectExists(s3, bucketName, key) {
    const params = {
        Bucket: bucketName,
        Key: key
    };

    try {
        await s3.headObject(params).promise();
        console.log("File exists in bucket in s3, not uploading " + key);
    } catch(error) {
        if (error) {  
            if (error.code === 'NotFound') {
                return false;
            }
        }
        throw new Error(`Error getting head metadata on key ${key}: ${error.message}`);
    }
    return true;
}

async function putUnsplashPageMarker(s3, unsplashPageMarker) {
    try {
        var key = process.env.UNSPLASH_PAGE_MARKER_KEY;

        await s3.putObject({
            Body: JSON.stringify(unsplashPageMarker),
            Key: key,
            Bucket: process.env.S3_BUCKET_NAME}).promise();
        console.log(`Success uploading to s3: ${key}`);
    } catch (e) {
        throw new Error(`Could not upload file from S3: ${e.message}`)
    }
} 