'use strict';

const app = require('../../app.js');
const chai = require('chai');
const expect = chai.expect;
var event, context;

describe('Test calling lambda handler', function () {
    it('verifies successful response', async () => {
        const result = await app.handler(event, context)

        expect(result).to.be.an('object');
        console.log("Printing Results of the test:" + JSON.stringify(result));
        expect(result.statusCode).to.equal(200);

    });
});
