#!/usr/bin/env node

const MqttMtl = require("@burgrp/mqtt-mtl");
const deepEqual = require("fast-deep-equal");
mqttReg = require("./mqtt-reg.js");
mqttAdvertise = require("./mqtt-advertise.js");

[
    nodePath,
    scriptPath,
    regName,
    regValue
] = process.argv;

let brokerAddress = process.env.MQTT;

if (!brokerAddress || regName === "-h" || regName === "--help") {
    console.info(
        `use:

to list registers and watch their values:
mqr

to get specific register value as JSON:
mqr <reg-name>

to set specific register value as JSON:
mqr <reg-name> <reg-value>

the tool expects MQTT environment variable to point to MQTT broker
`
    );
} else {

    const mqttMtl = MqttMtl(`mqtt://${brokerAddress}`);   

    if (!regName) {
        let regs = {};
        mqttAdvertise(mqttMtl, (name, meta) => {

            if (!regs[name]) {
                regs[name] = meta;
                console.info(name, "-", Object.entries(meta).map(([k, v]) => `${k}:${v}`).join(", "));               
                mqttReg(mqttMtl, name, (actual, prev, initial) => {
                    if (!initial) {
                        console.info(name, "=", actual);
                    }
                });
            }

        });
    } else {
        if (regValue === undefined) {

            mqttReg(mqttMtl, regName, (actual, prev, initial) => {
                if (!initial) {
                    console.info(JSON.stringify(actual));
                    process.exit(0);
                }
            });

        } else {
            regValue = JSON.parse(regValue);

            let reg = mqttReg(mqttMtl, regName, actual => {
                if (deepEqual(actual, regValue)) {
                    process.exit(0);
                }
            });

            reg.set(regValue);
        }
    }
}