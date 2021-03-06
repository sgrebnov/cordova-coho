/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

var optimist = require('optimist');
var path = require('path');
var apputil = require('./apputil');
var executil = require('./executil');
var flagutil = require('./flagutil');
var repoutil = require('./repoutil');

module.exports = function*() {
    var opt = flagutil.registerRepoFlag(optimist);
    opt = flagutil.registerHelpFlag(opt);
    opt.usage('Shows formatted git log for changes in the past 7 days.\n' +
              '\n' +
              'Usage: $0 last-week [--repo=ios] [--me] [--days=7]\n' +
              '    --me: Show only your commits\n' +
              '    --days=n: Show commits from the past n days');
    argv = opt.argv;

    if (argv.h) {
        optimist.showHelp();
        process.exit(1);
    }
    var repos = flagutil.computeReposFromFlag(argv.r);
    var filterByEmail = !!argv.me;
    var days = argv.days || 7;
    var userEmail = filterByEmail && (yield executil.execHelper(executil.ARGS('git config user.email'), true));
    var commitCount = 0;
    var pullRequestCount = 0;

    var cmd = executil.ARGS('git log --no-merges --date=short --all-match --fixed-strings');
    if (filterByEmail) {
        cmd.push('--committer=' + userEmail, '--author=' + userEmail);
    }

    apputil.print('Running command: ' + cmd.join(' ') + ' --format="$REPO_NAME %s" --since="' + days + ' days ago"');
    yield repoutil.forEachRepo(repos, function*(repo) {
        var repoName = repo.id + new Array(Math.max(0, 20 - repo.id.length + 1)).join(' ');
        var output = yield executil.execHelper(cmd.concat(['--format=' + repoName + ' %cd %s',
            '--since=' + days + ' days ago']), true);
        if (output) {
            console.log(output);
            commitCount += output.split('\n').length;
        }
    });

    if (filterByEmail) {
        console.log('\nPull requests:');
        cmd = executil.ARGS('git log --no-merges --date=short --fixed-strings', '--committer=' + userEmail);
        yield repoutil.forEachRepo(repos, function*(repo) {
            var repoName = repo.id + new Array(Math.max(0, 20 - repo.id.length + 1)).join(' ');
            var output = yield executil.execHelper(cmd.concat(['--format=%ae|' + repoName + ' %cd %s',
                '--since=' + days + ' days ago']), true);
            if (output) {
                output.split('\n').forEach(function(line) {
                    line = line.replace(/(.*?)\|/, '');
                    if (RegExp.lastParen.indexOf(userEmail) == -1) {
                        console.log(line);
                        pullRequestCount += 1;
                    }
                });
            }
        });
    }

    console.log('');
    if (filterByEmail) {
        console.log('Total Commits: ' + commitCount + ' Total Pull Requests: ' + pullRequestCount);
    } else {
        console.log('Total Commits: ' + commitCount);
    }
}
