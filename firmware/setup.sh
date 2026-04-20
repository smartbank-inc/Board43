#!/bin/sh
set -e

cd "$(dirname "$0")/picoruby"
git submodule update --init --recursive
bundle install
rake r2p2:setup
git apply ../picoruby.patch
