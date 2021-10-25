# ColorSplashPhotoRetrieval


## Description

ColorSplashPhotoRetrieval (CSPR) is a component of the overarching ColorSplash web application that can be found at https://thurau.io/colorsplash/. ColorSplash allows users to browse royalty free images that have colors within a certain Euclidean distance of a provided HEX code. CSPR runs in a NodeJS-14.x AWS Lambda runtime and uses the [Unsplash API](https://unsplash.com/documentation) to list royalty free images and stores them in an S3 bucket for later processing. CSPR runs asynchronously within the larger application context via CloudWatch Events.

You can see other components of this project in the following Github repos

- [ColorSplashPhotoProcessor](https://github.com/DanielThurau/ColorSplashPhotoProcessor)
- [ColorSplashColorDetector](https://github.com/DanielThurau/ColorSplashColorDetector)
- [thurau.io](https://github.com/DanielThurau/thurau.io)

## Motivation

A friend was facing issues when trying to create social media posts for an ecommerce company we recently launched. She had developed a branding guide and had chosen what colors she wanted to include in the website, logos, and eventual marketing material. But when it was time to make marketing posts, trying to apply that style guide was difficult. For all the tools on the internet she used, none were able to query royalty free images that were close to the HEX color codes she had selected. This project was born to remedy this issue. 

I wanted to provide a clean minimal interface on a website that would have a form for a HEX code, and query a REST API that would return royalty free images that had a subset of colors within close to the original HEX code.

## Features And Roadmap

### Features
1. Asynchronous Lambda triggered via CloudWatch Events
2. Uses the free Unsplash API to scan its dataset by staying within the minimum threshold of API calls per hour
3. Tracks which images have been scanned and put into S3
4. Infrastructure defined in template.yml
5. Configurable guardrails to keep it from filling S3 or DynamoDB in the event of a bug

### Roadmap
1. Write unit tests
2. Define the rest of the infrastructure used in the template.yml
3. Create a script to enable/disable the CloudWatch event from the CLI.
4. CI/CD so `$ sam deploy` is triggered from Github

## Tech Used

Due to CSPR's asychronous nature, it was designed to be run in a functional runtime from the start. Due to my history with AWS, I decided to use AWS as the cloud provider and write the project as a serverless application that is deployed using the AWS Serverless Application Model (AWS SAM) CLI tool. You can find out more about AWS SAM on its [homepage](https://aws.amazon.com/serverless/sam/).

The logic of the application is based on using the free [Unsplash API](https://unsplash.com/documentation) to programatically scan the entire library of royalty free images provided by Unsplash. Unsplash vends [several libraries and SDKs](https://unsplash.com/documentation#libraries--sdks), so I decided to use [unsplash-js](https://github.com/unsplash/unsplash-js) in a NodeJS-14.x AWS Lambda.

## Installation

### Required Tools
1. [git](https://git-scm.com/) - a free and open source distributed version control system
2. [node.js](https://nodejs.org/en/download/) - an asynchronous event-driven JavaScript runtime. Includes npm, a package manager for the JavaScript programming language
3. [Docker](https://www.docker.com/get-started) - an open source containerization platform. Required to run AWS SAM
4. [AWS CLI](https://aws.amazon.com/cli/) - a unified tool to manage your AWS services
5. [AWS SAM CLI](https://aws.amazon.com/serverless/sam/) - an open-source framework for building serverless applications

### Cloning The Project

You can either fork the repo or clone it directly with

```shell
$ git clone https://github.com/DanielThurau/ColorSplashPhotoRetrieval.git
$ cd ColorSplashPhotoRetrieval
```

### Configuring AWS

AWS SAM CLI will piggy back off of the AWS CLI configurations. It is worth while to configure this ahead of time. If considering contribution, open an issue on the project and credentials **may** be provided. If you want to clone and deploy to your own AWS accounts, configure your AWS CLI to have credentials via the `~/.aws/credentials` file. It will look like this

```shell
$ aws configure
AWS Access Key ID [None]: <your access key>
AWS Secret Access Key [None]: <your secret key>
Default region name [None]: <deployed region>
Default output format [None]: json
```

### Environmental Variables

There are several environmental variables needed to run this application. An example structure is found in `env.example` (// TODO Link this). Once you fill out the variables for local development, copy it to the src/ folder. The Lambda will also need to be configured with these values in the "Configuration-> Environmental Variables" via the AWS Console.

```shell
$ cp env.example src/.env
```

### AWS Infrastructure

This project uses AWS Lambda, AWS DynamoDB, AWS S3, and AWS CloudWatch. Since it's an AWS SAM application, the infrastructure is defined via the template.yml file which SAM will compile and create a CloudFormation stack. Most of the infrastructure for this component is written in this template.yml, but not all. See the **Roadmap** section to track upcoming improvements. If forking and deploying to a personal AWS account, some of the infrastructure will be missing and need to be manually created.

## Usage

This project uses AWS SAM CLI to build, test, and deploy, but running the code and unit tests via npm is also possible. However, it is advisable to use SAM CLI since the tool will mimic the lambda runtime.

### AWS SAM CLI

Start docker either as a background process, in another terminal tab, or via desktop application.

```shell
$ sam build
$ sam local invoke
$ sam deploy
```

### NPM

```shell
$ cd src/
$ npm install
$ npm run test
```

## Contribute

If you'd like to contribute, fork the project and submit a Pull Request. If you'd like access to the infrastructure to test, open an issue and request access. Access requests will be reviewed and granted on a case by case basis. 

## Credits

So many tutorials and blog posts deserve to have credits here, but alas I did not think to record all of them. I will be trying to fill this in as I write the ColorSplash blog post.

## License

See LICENSE.md

> MIT License
>
> Copyright (c) 2021 Daniel Thurau