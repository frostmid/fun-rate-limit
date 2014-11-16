var _ = require ('lodash'),
	Q = require ('q');

function rateLimit (func, rate, async) {
	var queue = {}; 
	var currentlyEmptyingQueue = {};
	
	var exec = function(queueID) {
		if (async) {
			_.defer (function () {
				var f = queue[queueID].shift ();
				if (f) f.call ();
			});
		} else {
			var f = queue[queueID].shift ();
			if (f) f.call ();
		}

		emptyQueue (queueID);
	};

	var emptyQueue = function (queueID) {
		if (queue[queueID].length) {
			if (!currentlyEmptyingQueue[queueID]) {
				exec (queueID);
			}

			currentlyEmptyingQueue[queueID] = true;

			_.delay (function(){ exec(queueID); }, rate);
		} else {
			currentlyEmptyingQueue[queueID] = false;
		}
	};

	return function () {
		// get arguments into an array
		var args = _.map (arguments, function(e) {
			return e;
		});
		
		var queueID = _.findLast(_.flatten(arguments), function(item) { return typeof item.queueID != 'undefined'; });
		queueID = (typeof queueID != 'undefined') ? queueID.queueID : null;
		
		if (typeof queue[queueID] == 'undefined') queue[queueID] = [];

		// call apply so that we can pass in arguments as parameters as opposed to an array
		queue[queueID].push (
			_.bind.apply (this, [func, this].concat (args))
		);
		
		if (!currentlyEmptyingQueue[queueID]) {
			emptyQueue (queueID);
		}
	};
};


module.exports = {
	sync: function (func, rate) {
		return rateLimit (func, rate, false);
	},

	async: function (func, rate) {
		return rateLimit (func, rate, true);
	},

	promise: function (func, rate) {
		var limited = module.exports.sync (function (deferred, args) {
			Q.when (
				func.apply (null, args)
			)
				.then (deferred.fulfill.bind (deferred))
				.fail (deferred.reject.bind (deferred))
				.done ();
		}, rate);

		return function () {
			var deferred = Q.defer ();
			limited (deferred, arguments);

			return deferred.promise;
		};
	}
}
