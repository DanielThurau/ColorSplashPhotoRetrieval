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
    const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});


    const unsplashPageMark = await getUnsplashPageMarker(s3);
    console.log("Retrieved the unsplash page marker: " + JSON.stringify(unsplashPageMark));

    await checkStats(ddb, unsplashPageMark);

    await retrievePhotos(s3, ddb, unsplashPageMark);

    unsplashPageMark.page++;

    await putUnsplashPageMarker(s3, unsplashPageMark);

    return 200;
    
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
            Bucket: process.env.S3_CONFIG_BUCKET_NAME,
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

async function checkStats(ddb, unsplashPageMark) {
    var estimatedBucketSize = unsplashPageMark.page * unsplashPageMark.perPage;
    // TODO do an actual bucket size
    if (estimatedBucketSize > 1050) {
        console.log("Activating Safegaurd for number of objects within S3. Estimated Size: " + estimatedBucketSize + ". Safegaurd: 1000.");
        throw new Error("S3 bucket full");
    }

    var estimatedTableRows = await ddb.describeTable({TableName: "ColorSplashImageIds"}).promise();
    if (estimatedTableRows.Table.ItemCount > 10,000) {
        console.log("Activating Safeguard for number of objects within DynamoDB. Estimated Size: " + estimatedTableRows + ". Safeguard: 10,000.");
        throw new Error("DDB table full");
    }

    console.log(`Stats: Number of S3 Objects=${estimatedBucketSize}, Number of DDB Rows=${estimatedTableRows.Table.ItemCount}`);
}

async function retrievePhotos(s3, ddb, unsplashPageMark) {
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
                    const urls = photo.urls;
                    const key = photo.id;
                    await transferToS3(urls, ddb, s3, key);
                }));
            }
      });
}

async function transferToS3(urls, ddb, s3, key) {

    console.log("Attempting to upload photo to " + key);
  
    var options = {
      uri: urls.raw,
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
                    keyExists = await checkIfObjectExists(ddb, key);
                } catch (err) {
                    reject(err);
                }
                
                var keyFileName = key.toString() + ".jpg";
                if (!keyExists) {  
                    try {
                        await s3.putObject({
                            Body: body,
                            Key: keyFileName,
                            Bucket: process.env.S3_BUCKET_NAME}).promise();
                        console.log("Success uploading to s3: " + key );
                        await putKey(ddb, key, urls);

                    } catch (err) {
                        console.log("Error uploading image to s3: " + key);
                        console.log(err);
                        reject(err);
                    }
                } else{
                    console.log("Failed updloading to s3: " + key + ". Reason: Key already exists in table.")
                }
                resolve(body);         
            }   
        });
    });   
}

async function checkIfObjectExists(ddb, key) {
    let result = await queryKey(ddb, key);
    if (result.Item !== undefined && result.Item !== null) {
        return true;
    }

    return false;
}

async function putUnsplashPageMarker(s3, unsplashPageMarker) {
    try {
        var key = process.env.UNSPLASH_PAGE_MARKER_KEY;

        await s3.putObject({
            Body: JSON.stringify(unsplashPageMarker),
            Key: key,
            Bucket: process.env.S3_CONFIG_BUCKET_NAME}).promise();
        console.log(`Success uploading to s3: ${key}`);
    } catch (e) {
        throw new Error(`Could not upload file from S3: ${e.message}`)
    }
} 

async function queryKey(ddb, key) {
    const tableName = "ColorSplashImageIds";

    try {
        var params = {
            Key: {
             "ImageId": {
                 S: key,
             }, 
            }, 
            TableName: tableName
        };
        return await ddb.getItem(params).promise();
        
    } catch (error) {
        throw new Error(`Could not query key from DynamoDB: ${error.message}`)
    }
}

async function putKey(ddb, key, urls) {
    const tableName = "ColorSplashImageIds";

    try {
        var params = {
            Item: {
             "ImageId": {
                 S: key,
             },
             "SmallURL": {
                 S: urls.small
             },
             "FullURL": {
                 S: urls.full
             },
             "RegularURL": {
                 S: urls.regular
             },
             "ThumbnailURL": {
                 S: urls.thumb
             }
            }, 
            TableName: tableName
        };

        await ddb.putItem(params).promise();
    } catch (error) {
        throw new Error(`Could not put key in DynamoDB: ${error.message}`)
    }
}