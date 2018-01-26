# processAudioTagsLambda
Lambda function in NodeJS that creates dynamoDB backend data from S3 files.

Using the lambda function and hooking it up to S3 put notifications the [StreamMyMusic](https://github.com/clfronk/StreamMyMusic) skill can have it's backend database
updated any time that new files are upload to the designated S3 bucket.

This project reads the ID3 tags from the audio files and populates the DynamoDB database table.
