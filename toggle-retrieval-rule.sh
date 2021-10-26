#!/bin/bash

while getopts hed flag
do
    case "${flag}" in
        h) di=false;en=false;he=true;;
        e) en=true;di=false;he=false;;
        d) di=true;en=false;he=false;;
    esac
done

if $he ; then
    echo 'Use: ./toggle-retrieval-rule [-e enables the EventBridge rule] [-d disable the EventBridge rule] [-h Print this help :)]'
    exit
fi

if $di ; then
    echo 'Disabling the ColorSplashPhotoRetrievalRule rule in EventBridge'
    aws events disable-rule --name "ColorSplashPhotoRetrievalRule"
    exit
fi

if $en ; then
    echo 'Enabling the ColorSplashPhotoRetrievalRule rule in EventBridge'
    aws events enable-rule --name "ColorSplashPhotoRetrievalRule"
    exit
fi

echo 'Use: ./toggle-retrieval-rule [-e enables the EventBridge rule] [-d disable the EventBridge rule] [-h Print this help :)]'