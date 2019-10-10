// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

// var settings = new Store("settings", {
//     "sample_setting": "This is how you use Store.js to remember values"
// });

//example of using a message handler from the inject scripts

const debounce = (func, delay) => {
    let timeoutId;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    }
}

var userId, name;

const appData = {};

const init = async () => {
    await fetch("https://elevate.darwinbox.in/attendance")
        .then(x => x.text())
        .then(x => {
            let div = document.createElement('div')
            div.innerHTML = x;
            userId = div.querySelector('#phpVar').value;
            name = div.querySelector('.title-3').innerText
        })
        .then(() => {
            getAttendenceLog()
                .then(async (todayLog) => {
                    const targetHours = await getAverageHours(requiredAverage);
                    if (todayLog[1]) {
                        const checkoutTime = getCheckoutTime(targetHours, todayLog);
                        chrome.alarms.create("checkoutAlarm", { when: checkoutTime.getTime() })
                    }
                })
        })
}

init();


chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
    chrome.pageAction.show(sender.tab.id);
    sendResponse();
});


const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0);
    today.setMilliseconds(0);
    return today;
}
const todayPlc = getToday();
todayPlc.setHours(10);

chrome.alarms.create("updateCheckInInfo", {
    when: todayPlc.getTime(),
    periodInMinutes: 60
});

var todayLog;
var requiredAverage = "09:00";

const getAttendenceLog = () => {
    const url = "https://elevate.darwinbox.in/attendance/attendance/getAttendanceLog";
    var body = `user_id=${userId}&work_duration=1&latemark=1&overtime=1&disable_break_duration=1&disable_first_clockin=1&disable_first_clockout=1&disable_final_work_duration=1& disable_early_out=1`
    return fetch(url, {
        body: body,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' }
    })
        .then(x => {
            return x.text()
        })
        .then(x => {
            const today = JSON.parse(x).update.find(x => {
                const date = new Date(x[0].split(',')[0]);
                const today = getToday();
                if (date.getTime() === today.getTime()) {
                    return true;
                }
            })
            todayLog = today;
            return today;
        })
        .catch(() => {
        })
}


chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (alarm.name === 'checkoutAlarm') {
        new Notification("Rest in peace!")
    } else if (alarm.name === 'updateCheckInInfo') {
        const date = todayLog ? new Date(todayLog[0].split(',')[0]) : null
        if (!date || !todayLog[1] || date.getTime() !== getToday().getTime()) {
            userId && getAttendenceLog();
        }
    }
});

const getCheckoutTime = (targetHours, todayLog) => {
    if (todayLog[1]) {
        let checkout = new Date(todayLog[0].split(',')[0] + " " + todayLog[1]);
        const millis = Math.round(targetHours * 60 * 60 * 1000)
        checkout.setTime(checkout.getTime() + millis)
        return checkout;
    }
}

const setAlarm = debounce(async () => {
    chrome.alarms.clear("checkoutAlarm")
    const targetHours = await getAverageHours(requiredAverage);
    if (todayLog[1]) {
        const checkoutTime = getCheckoutTime(targetHours, todayLog);
        chrome.alarms.create("checkoutAlarm", { when: checkoutTime.getTime() })
    }
}, 60 * 1000);

const onMessage = async (message) => {
    if (message.type === 'attendanceDetails') {
        appData.attendanceDetails = message.data
    } else {
        requiredAverage = message;
        setAlarm();
    }
}

chrome.extension.onConnect.addListener(function (port) {
    port.postMessage({ type: 'todayLog', todayLog: todayLog, requiredAverage: requiredAverage, userId: userId, name });
    port.postMessage({ type: 'attendanceDetails', data: appData.attendanceDetails });
    port.onMessage.addListener(onMessage);
})

const getAverageHours = (targetValue) => {

    return new Promise((resolve) => {
        const timeToHours = time => {
            const tArr = time.split(":").map(Number);
            return Number(tArr[0] + '.' + Number(tArr[1] / 60).toFixed(2).split('.')[1])

        }

        function estimateAverageHours(totalWorkingDays, daysRemaining, target, currentAverage, misPunches) {
            return ((timeToHours(target) * totalWorkingDays) - timeToHours(currentAverage) * (totalWorkingDays - daysRemaining - misPunches) - (misPunches * 9)) / daysRemaining;
        }


        const holidays = {
            82019: [],
            92019: [2, 8, 28],
            102019: [12],
            112019: [25],

        }
        var req = new XMLHttpRequest();
        const today = new Date();
        let monthStartTime = (new Date(today.getFullYear(), today.getMonth(), 1)).getTime();
        const start = Math.round(monthStartTime / 1000);
        const end = Math.round((monthStartTime + (32 * 24 * 60 * 60 * 1000)) / 1000);
        req.open(
            "GET",
            `https://elevate.darwinbox.in/attendance/attendance/getAttendanceLogCalendar/id/${userId}?start=${start}&end=${end}&_=${Date.now()}`);
        req.onload = onResponseReceived;
        req.send(null);

        var currentAverage;
        const getWeekdays = (year, month, day = 32) =>
            new Array(32 - new Date(year, month, day).getDate())
                .fill(1)
                .filter(
                    (id, index) =>
                        [0, 6].indexOf(
                            new Date(year, month, index + 1).getDay()) === -1
                ).length
        const weekdays = getWeekdays(today.getFullYear(), today.getMonth());
        let currentMonthHolidays = holidays[today.getMonth().toString() + today.getFullYear()] || [];
        let totalWorkingDays = weekdays - (currentMonthHolidays ? currentMonthHolidays.length : 0);
        const daysRemaining = getWeekdays(today.getFullYear(), today.getMonth(), today.getDate()) - currentMonthHolidays.filter(x => x > today.getDate()).length


        function onResponseReceived(e) {
            const json = JSON.parse(e.currentTarget.responseText);
            const last = json.pop();
            misPunches = json.filter(x => x.title.indexOf('Single Punch') > -1).length;
            currentAverage = last.attendance_summary.avg_total_work_duration;

            const targetHours = estimateAverageHours(totalWorkingDays, daysRemaining, targetValue, currentAverage, misPunches)

            resolve(targetHours)
        }


    })
}
