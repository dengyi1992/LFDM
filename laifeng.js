/**
 * Created by deng on 16-7-13.
 */


var net = require('net');
var loginInfo = {"uri": "0", "type": "0", "svc_link": "66b2c67d-f7ab-4355-a6f0-b52ffccc857e"};
var sureinfo = {
    "uri": "1",
    "top_sid": "54880976",
    "sub_sid": "54880976",
    "svc_link": "66b2c67d-f7ab-4355-a6f0-b52ffccc857e"
};


// var socket = require('engine.io-client')('ws://tvgw.yy.com:26101/websocket');

function monitorRoom(roomid) {
    var cookie;
    var WebSocketClient = require('websocket').client;

    var client = new WebSocketClient();

    client.on('connectFailed', function (error) {
        console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function (connection) {

        console.log('WebSocket Client Connected');
        connection.on('error', function (error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on('close', function () {
            console.log('echo-protocol Connection Closed');
        });
        connection.on('message', function (message) {
            if (message.type === 'utf8') {
                console.log(message.utf8Data);
                var utf8Data = message.utf8Data;
                if (utf8Data.indexOf('0:::') == 0) {
                    console.log("error")
                } else if (utf8Data.indexOf('1:::') == 0) {
                    console.log("connect");
                    sendData("5:::"+String(JSON.stringify({name:"enter",args:[{token:"MjAyMjQxNzAzNC0wLTE0Njg0ODEwNjQzOTQtMTAwMA==-DB492D479113F62F20B5DE7E0A379EF6",uid:"2022417034",roomid:"69775",endpointtype:"ct_,dt_1_1003|0|ad1967764ff745308a23413926d9f497_1468481065280"}]})));
                } else if (utf8Data.indexOf('2:::') == 0) {
                    //heart beat 跟进
                    sendData(String('2::'));


                } else if (utf8Data.indexOf('3:::') == 0) {
                    console.log("buqingchu")
                }else if (utf8Data.indexOf('4:::') == 0) {
                    console.log("buqingchu")
                }else if (utf8Data.indexOf('5:::') == 0) {
                    console.log("data")
                }
            }
        });
        function sendData(data) {
            try {
                if (connection.connected) {
                    connection.send(data.toString());
                    setTimeout(sendData, 1000);
                }
            } catch (e) {
                console.log(e.message);
            }

        }

        // setInterval(function () {
        //     sendData(time);
        // }, 45000);
        // function sendNumber() {
        //     if (connection.connected) {
        //         var number = Math.round(Math.random() * 0xFFFFFF);
        //         connection.sendUTF(number.toString());
        //         setTimeout(sendNumber, 1000);
        //     }
        // }
        // sendNumber();
    });

    client.connect('ws://chatroom02.laifeng.com:10024/socket.io/1/websocket/');

}

monitorRoom('12345');
