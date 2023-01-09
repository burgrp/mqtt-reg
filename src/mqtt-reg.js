const deepEqual = require("fast-deep-equal");

module.exports = (
	{
		mqttMtl,
		name,
		callback,
		timeoutMs,
	}) => {

	if (!timeoutMs) {
		timeoutMs = 8000 + Math.random() * 4000;
	}

	let timeout;
	let firstTimeout;
	let actual;
	let desired;
	let unset = true;
	let askedByAnother = false;

	function safeCb(...args) {
		try {
			callback(...args);
		} catch (e) {
			console.error("Error in register callback", e);
		}
	}

	function topic(suffix) {
		return `register/${name}/${suffix}`;
	}

	function resetTimeout() {

		askedByAnother = false;

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(() => {

			if (!firstTimeout) {
				let prev = actual;
				actual = undefined;
				if (!deepEqual(actual, prev)) {
					safeCb(actual, prev, false);
				}
			}

			firstTimeout = false;
			getOrSet();
			resetTimeout();

		}, timeoutMs);
	}

	function getOrSet() {
		if (desired !== undefined) {
			mqttMtl.publish(topic("set"), JSON.stringify(desired));
		} else {
			if (!askedByAnother) {
				mqttMtl.publish(topic("get"));
			}
		}
	}

	// reset timeout if someone else is also trying to get/set the register
	mqttMtl.subscribe(topic("get"), (topic, message) => {
		askedByAnother = true;
	});

	mqttMtl.subscribe(topic("set"), (topic, message) => {
		askedByAnother = true;
	});

	mqttMtl.subscribe(topic("is"), (topic, message) => {

		firstTimeout = true;
		let prev = actual;

		let str = message.toString();
		if (str === "") {
			actual = undefined;
		} else {
			actual = JSON.parse(str);
		}

		if (deepEqual(actual, desired)) {
			desired = undefined;
		}

		if (!deepEqual(actual, prev) || unset) {
			safeCb(actual, prev, false);
		}
		unset = false;

		resetTimeout();
	});

	getOrSet();
	safeCb(actual, undefined, true);
	resetTimeout();

	return {
		set(value) {
			if (!deepEqual(desired, value) && !deepEqual(actual, value)) {
				desired = value;
				getOrSet();
			}
		},
		actual() {
			return actual;
		}
	};
};
