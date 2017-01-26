
'use strict';

var async = require.main.require('async');
var winston = require.main.require('winston');

var db = require.main.require('./src/database');

var batch = require.main.require('./src/batch');

var plugin = {};

plugin.onCategoryCreate = function(data) {
	var now = Date.now();
	batch.processSortedSet('users:joindate', function(uids, next) {
		var keys = uids.map(function(uid) {
			return 'uid:' + uid + ':ignored:cids';
		});
		var nowArray = uids.map(function() {
			return now;
		});
		async.parallel([
			function (next) {
				db.sortedSetsAdd(keys, now, data.category.cid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + data.category.cid + ':ignorers', nowArray, uids, next);
			}
		], next);
	}, {batch: 500}, function(err) {
		if (err) {
			winston.error(err);
		}
	});
};

plugin.onUserCreate = function(data) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('categories:cid', 0, -1, next);
		},
		function (cids, next) {
			var now = Date.now();
			var nowArray = cids.map(function() {
				return now;
			});
			async.parallel([
				function (next) {
					db.sortedSetAdd('uid:' + data.user.uid + ':ignored:cids', nowArray, cids, next);
				},
				function (next) {
					var keys = cids.map(function (cid) {
						return 'cid:' + cid + ':ignorers';
					});
					db.sortedSetsAdd(keys, now, data.user.uid, next);
				}
			], next);
		}
	], function(err) {
		if (err) {
			winston.error(err);
		}
	});
};

module.exports = plugin;

