const mqttMM = require("./mqtt-mm.js");
const deepEqual = require("fast-deep-equal");

module.exports = (broker, register, cb, timeoutMs) => {

	if (!timeoutMs) {
		timeoutMs = 8000 + Math.random() * 4000;
	}

	const client = mqttMM(`mqtt://${broker}`);

	let timeout;
	let firstTimeout;
	let actual;
	let desired;
	let unset = true;

	function safeCb(...args) {
		try {
			cb(...args);
		} catch (e) {
			console.error("Error in register callback", e);
		}
	}

	function resetTimeout() {
		
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
			client.publish(`register/${register}/set`, JSON.stringify(desired));
		} else {
			client.publish(`register/${register}/get`);
		}
	}

	// reset timeout if someone else is also trying to get/set the register 
	client.subscribe(`register/${register}/get`, (topic, message) => {
		resetTimeout();
	});

	client.subscribe(`register/${register}/set`, (topic, message) => {
		resetTimeout();
	});

	client.subscribe(`register/${register}/is`, (topic, message) => {

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
