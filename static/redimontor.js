$(document).ready(function() {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};

    updater.charts = updater.charts || {};
    updater.charts.memory = updater.charts.memory || {}
    updater.charts.topCommands = updater.charts.topCommands || {}
    updater.charts.topKeys = updater.charts.topKeys || {}
    updater.charts.heaviestCommands = updater.charts.heaviestCommands || {}
    updater.charts.slowestCalls = updater.charts.slowestCalls || {}
    updater.charts.prefixes = updater.charts.prefixes || {}
    updater.charts.times = updater.charts.times || {}


    updater.charts.memory.chart = new google.visualization.LineChart($("#memory-widget-chart").empty().get(0));
    updater.charts.memory.dataTable = new google.visualization.DataTable()
    updater.charts.memory.dataTable.addColumn('datetime', 'datetime')
    updater.charts.memory.dataTable.addColumn('number', 'Byte')
    updater.charts.memory.options = {
                      title : '',
                      colors: [ '#1581AA' ],
                      pointSize: 5,
                      chartArea: { 'top' : 10, 'width' : '85%' },
                      width : "100%",
                      height : 200,
                      animation : { duration : 500, easing : 'out' }
    }

    updater.charts.topCommands.chart = new google.visualization.ColumnChart($("#top-commands-widget-chart").empty().get(0));
    updater.charts.topCommands.dataTable = new google.visualization.DataTable()

    updater.charts.topKeys.chart = new google.visualization.ColumnChart($("#top-keys-widget-chart").empty().get(0));
    updater.charts.topKeys.dataTable = new google.visualization.DataTable()

    updater.charts.heaviestCommands.chart = new google.visualization.ColumnChart($("#heaviest-keys-widget-chart").empty().get(0));
    updater.charts.heaviestCommands.dataTable = new google.visualization.DataTable()

    updater.charts.slowestCalls.chart = new google.visualization.ColumnChart($("#slowest-keys-widget-chart").empty().get(0));
    updater.charts.slowestCalls.dataTable = new google.visualization.DataTable()

    updater.charts.prefixes.chart = new google.visualization.ColumnChart($("#top-prefixes-widget-chart").empty().get(0));
    updater.charts.prefixes.dataTable = new google.visualization.DataTable()

    updater.charts.times.chart = new google.visualization.ColumnChart($("#times-widget-chart").empty().get(0));
    updater.charts.times.dataTable = new google.visualization.DataTable()

    updater.start();
});



var updater = {
    socket: null,
    /* json object properties and chart name */
    CHART_MAP: [
        ["prefixes", "prefixes"],
        ["keys"    , "topKeys"],
        ["commands", "topCommands"],
        ["times", "times"],
        ["heaviest", "heaviestCommands"],
        ["slowest", "slowestCalls"],
    ],

    start: function() {
        var url = "ws://" + location.host + "/redimontor";
        updater.socket = new WebSocket(url);
        updater.socket.onmessage = function(event) {
            updater.showMessage(JSON.parse(event.data));
        };

        updater.socket.onclose = function() {
            updater.socket = null;
            updater.start();
        }
    },
    update_info: function(message) {
        $("#used_memory .well-value").text(message.data['used_memory_human'])
        var i = 0;
        var keys = 0;
        while(true) {
            if(!message.data.hasOwnProperty("db"+i)) {
                break;
            }
            keys += message.data["db"+i].keys;
            i++;
        }
        for(var i = 0; i<15; i++){

        }
        $("#total-keys .well-value").text(keys)
        $("#connected_clients .well-value").text(message.data['connected_clients'])
        $("#total_commands_processed_human .well-value").text(message.data['total_commands_processed'])
        $("#uptime .well-value").text(updater.secondsToStr(message.data['uptime_in_seconds']))


        updater.charts.memory.dataTable.addRow( [new Date(), message.data['used_memory']] )
        updater.charts.memory.chart.draw(updater.charts.memory.dataTable, updater.charts.memory.options)

    },

    update_chart: function(data, chartname) {
        updater.charts[chartname].dataTable.removeRows(0, updater.charts[chartname].dataTable.getNumberOfRows())
        updater.charts[chartname].dataTable.removeColumns(0, updater.charts[chartname].dataTable.getNumberOfColumns())
        updater.charts[chartname].dataTable.addColumn('string', 'command')
        updater.charts[chartname].dataTable.addColumn('number', 'count')

        $(data).each(function(idx, item){
            updater.charts[chartname].dataTable.addRow([item[0], item[1]])
        })

        var options = {
                      title : '',
                      colors : [ '#008FD5', '#006B9F', '#454545', '#E70B20' ],
                      chartArea: { 'left' : 100, 'top' : 10, 'width': '90%', 'height': '200' },
                      height : 250,
                      animation: { duration : 500, easing : 'linear' },
                      legend: { position: 'none' }
         }
        updater.charts[chartname].chart.draw(updater.charts[chartname].dataTable, options)
    },




    update_charts: function(message) {
        $(updater.CHART_MAP).each(function(idx, chart_map){
            if(chart_map[0] == "times") {
                console.log(message.data[chart_map[0]])
            }
            updater.update_chart(message.data[chart_map[0]], chart_map[1])
        })


    },

    showMessage: function(message) {
        if(message['type'] == "info") {
            updater.update_info(message)
        }
        else if(message['type'] == "stats") {
            updater.update_charts(message)
        }
    },

    secondsToStr: function (seconds) {

        var numberEnding = function (number) {
            return (number > 1) ? 's ' : '';
        }

        var years = Math.floor(seconds / 31536000);
        var word = ""
        if (years) {
            word += years + ' year' + numberEnding(years);
        }
        var days = Math.floor((seconds %= 31536000) / 86400);
        if (days) {
            word += days + ' day' + numberEnding(days);
        }
        var hours = Math.floor((seconds %= 86400) / 3600);
        if (hours) {
            word += hours + ' hour' + numberEnding(hours);
        }
        var minutes = Math.floor((seconds %= 3600) / 60);
        if (minutes) {
            word +=  minutes + ' minute' + numberEnding(minutes);
        }
        var seconds = seconds % 60;
        if (seconds) {
            word +=  seconds + ' second' + numberEnding(seconds);
        }
        if(word == "") {
            return "now";
        }
        return word;
    }
};