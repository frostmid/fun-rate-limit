var _ = require ('lodash'),
	Promises = require ('vow');

function rateLimit (func, rate, async) {
	var queue = [];
	var timeOutRef = false;
	var currentlyEmptyingQueue = false;

	var exec = function() {
		if (async) {
			_.defer (function () {
				var f = queue.shift ();
				if (f) f.call ();
			});
		} else {
			var f = queue.shift ();
			if (f) f.call ();
		}

		emptyQueue ();
	};

	var emptyQueue = function () {
		if (queue.length) {
			if (!currentlyEmptyingQueue) {
				exec ();
			}

			currentlyEmptyingQueue = true;

			_.delay (exec, rate);
		} else {
			currentlyEmptyingQueue = false;
		}
	};

	return function () {
		// get arguments into an array
		var args = _.map (arguments, function(e) {
			return e;
		});
		
		// call apply so that we can pass in arguments as parameters as opposed to an array
		queue.push (
			_.bind.apply (this, [func, this].concat (args))
		);

		if (!currentlyEmptyingQueue) {
			emptyQueue ();
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
		var limited = module.exports.sync (function (promise, args) {
			Promises.when (
				func.apply (null, args)
			)
				.then (_.bind (promise.fulfill, promise))
				.fail (_.bind (promise.reject, promise))
				.done ();
		}, rate);

		return function () {
			var promise = Promises.promise ();

			limited (promise, arguments);

			return promise;
		};
	}
}