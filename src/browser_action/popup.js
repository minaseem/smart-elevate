var port = chrome.extension.connect({
    name: "Sample Communication"
});

const popupData = { attendanceSummary: {} };

const holidays = {
    82019: [],
    92019: [2, 8, 28],
    102019: [12],
    112019: [25]
}

const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0);
    today.setMilliseconds(0);
    return today;
}

function estimateAverageHours(target) {
    const { misPunches, currentAverage } = popupData.attendanceSummary;
    const { totalWorkingDays, daysRemaining } = getDaysSummary();
    return ((timeToHours(target) * totalWorkingDays) - timeToHours(currentAverage) * (totalWorkingDays - daysRemaining - misPunches) - (misPunches * 9)) / daysRemaining;
}

const timeToHours = time => {
    const tArr = time.split(":").map(Number);
    return Number(tArr[0] + '.' + Number(tArr[1] / 60).toFixed(2).split('.')[1])

}

const twoDigit = num => Number(num) > 9 ? num : '0' + num;

const hoursToTime = time => {
    const tArr = time.toString().split(".");
    return twoDigit(tArr[0]) + ':' + twoDigit(Math.ceil(Number('0.' + (tArr[1] || 0)) * 60))

}

const getCheckoutTime = (targetHours) => {
    let todayLog = popupData.todayLog;
    if (todayLog[1]) {
        let checkout = new Date(todayLog[0].split(',')[0] + " " + todayLog[1]);
        const millis = Math.round(targetHours * 60 * 60 * 1000)
        checkout.setTime(checkout.getTime() + millis)
        return checkout;
    }
}

const getTime = (date) => {
    const hours = date.getHours(), minutes = date.getMinutes(), seconds = date.getSeconds();
    return `${twoDigit(hours)}:${twoDigit(minutes)}:${twoDigit(seconds)} ${hours > 11 ? 'PM' : 'AM'}`
}

const updateCheckoutTime = (targetHours) => {
    let todayLog = popupData.todayLog;
    const checkoutTime = getCheckoutTime(targetHours, todayLog);
    if (checkoutTime) {
        document.querySelector('#checkout').innerHTML = getTime(checkoutTime);
    }
}

const getDaysSummary = () => {
    const today = new Date();
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
    return { totalWorkingDays, daysRemaining };
}

const updateDaysSummary = () => {
    const { totalWorkingDays, daysRemaining } = getDaysSummary();
    document.querySelector('#totalDays').innerHTML = totalWorkingDays;
    document.querySelector('#remainingDays').innerHTML = daysRemaining;
}

const updateRequiredHours = () => {
    const targetHours = estimateAverageHours(popupData.requiredAverage)

    let newHours = hoursToTime(targetHours);
    document.querySelector('#newHours').innerHTML = newHours;
    updateCheckoutTime(targetHours);
}

const updateCurrentAverage = () => {
    const { currentAverage } = popupData.attendanceSummary;
    document.querySelector('#average').innerHTML = currentAverage;
}

const populateData = function () {
    var req = new XMLHttpRequest();
    const today = new Date();
    let monthStartTime = (new Date(today.getFullYear(), today.getMonth(), 1)).getTime();
    const start = Math.round(monthStartTime / 1000);
    const end = Math.round((monthStartTime + (32 * 24 * 60 * 60 * 1000)) / 1000);
    req.open(
        "GET",
        `https://elevate.darwinbox.in/attendance/attendance/getAttendanceLogCalendar/id/${popupData.userId}?start=${start}&end=${end}&_=${Date.now()}`);
    req.onload = onResponseReceived;
    req.send(null);

    function onResponseReceived(e) {
        debugger;
        const json = JSON.parse(e.currentTarget.responseText);
        const last = json.pop();
        const misPunches = json.filter(x => x.title.indexOf('Single Punch') > -1).length;
        const currentAverage = last.attendance_summary.avg_total_work_duration;
        const attendanceDetails = {
            misPunches,
            currentAverage,
            timestamp: getToday().getTime()
        };

        popupData.attendanceSummary = attendanceDetails;
        updateCurrentAverage();
        updateRequiredHours();

        port.postMessage({
            type: 'attendanceDetails',
            data: attendanceDetails
        });
    }


    document.querySelector('#averageInput').addEventListener('keyup', e => {
        const val = e.target.value;
        if (/[0-2]?[0-9]:[0-5]?[0-9]/.test(val)) {
            popupData.requiredAverage = val;
            const targetHours = estimateAverageHours(val)
            document.querySelector('#newHours').innerHTML = hoursToTime(targetHours);
            updateCheckoutTime(targetHours);
            port.postMessage(val);
        }
    })
};


const init = () => {
    updateDaysSummary();
}

var port = chrome.extension.connect({
    name: "Sample Communication"
});


port.onMessage.addListener(function (payload) {
    if (payload.type === 'todayLog') {
        popupData.todayLog = payload.todayLog;
        popupData.userId = payload.userId;
        popupData.name = payload.name;
        popupData.requiredAverage = payload.requiredAverage;
        document.querySelector('#averageInput').value = popupData.requiredAverage;
        document.querySelector('#checkIn').innerHTML = popupData.todayLog[1];
        document.querySelector('#name').innerHTML = popupData.name;
    } else if (payload.type === 'attendanceDetails') {
        if (payload.data && payload.data.timestamp === getToday().getTime()) {
            popupData.attendanceSummary = payload.data;
            updateCurrentAverage();
            updateRequiredHours();
        } else {
            populateData();
        }
    }
});


init();




