//websocket
Object.keys = Object.keys || function(obj){/**兼容IE**/
    var result = [];
        for(var key in obj )
            if(({}).hasOwnProperty.call(obj,key)){
                result.push(key) ;
            }
        return result;
    };
WEB_SOCKET_SWF_LOCATION = "/swf/WebSocketMain.swf?time="+new Date().getTime();
WEB_SOCKET_DEBUG = true;
var ws;

var global_current_client_id = '';
var chat = function (){
    var that=this;
    // 连接服务端
    this.connect = function () {
        // 创建websocket
        ws = new WebSocket("ws://"+document.domain+":8282");
        // 当socket连接打开时，输入用户名
        ws.onopen = that.onopen;
        // 当有消息时根据消息类型显示不同信息
        ws.onmessage = that.onmessage;
        ws.onclose = function(e) {
            debug_log("连接关闭，定时重连");
            window.setTimeout(that.connect,3000);
        };
        ws.onerror = function(e) {
            debug_log(e);
        };
    };
    this.object_md5 = function (obj) {
        var keys = Object.keys(obj).sort();
        var stringfy = '', prop;
        for (var i = 0; i < keys.length; i++) {
            prop = keys[i];
            if(stringfy != '') stringfy += '&';
            stringfy += (prop + '=' + obj[prop]);
        }
        return md5(stringfy);
    };


    // 连接建立时发送WEBSOCKET登录信息
    this.onopen = function ()
    {
        var login_data = {
            type:"login",
            game_id:typeof gameObj == 'undefined' ? 'HALL' : gameObj.id,
            uid:userinfo ?　userinfo.id : 0,
            nickname:userinfo ? userinfo.nickname : ''//直接传给服务端，避免websocket读DB了。
        };
        that.sendMsg(login_data);
    };

// 服务端发来消息时
    this.onmessage = function (e)
    {
        debug_log("on message:"+e.data);
        var data = JSON.parse(e.data);
        that.agentDistribute(data);
    };


    this.sendMsg = function(data){
        debug_log("do send 原始数据"+JSON.stringify(data));
        var string_data = '';
        switch (typeof data)
        {
            case 'string':
                string_data = data;
                break;
            case 'object':
                data['_token'] = ws_token['token'];
                data['_timestamp'] = ts_delta + Math.round(new Date().getTime()/1000);
                var full_data_obj = JSON.parse(JSON.stringify(data));//copy
                full_data_obj['_secret'] = ws_token['secret'];//secret 不会打包进数据
                data['_checksum'] = this.object_md5(full_data_obj);
                string_data = JSON.stringify(data);
                break;
            default:
                break;
        }
        debug_log("do send 最终发送"+string_data);
        ws.send(string_data);
    };

    //消息代理分发
    this.agentDistribute = function(data){
        if(typeof data.type != 'string' || data.type == '')
        {
            return;
        }
        var function_name = 'action'+data['type'].charAt(0).toUpperCase() + data['type'].slice(1);
        if(typeof that[function_name] == 'function')
        {
            return that[function_name](data);
        }
    };

    // 服务端ping客户端
    this.actionPing = function(_data){
        that.sendMsg({type:"pong"});
    };
    // 服务端ping客户端
    this.actionLogin = function(_data){
        var new_li = $(document.createElement("li"));
        $(document.createElement('span')).text(_data.user.nickname + " 进入了房间").appendTo(new_li);
        new_li.appendTo($("#chat_content"));
        //滚动。
        $("#chat_content_list").scrollTop($("#chat_content_list")[0].scrollHeight - $("#chat_content_list").height());
    };


    //进入房间之后会接收到自己的client_id 和一些历史消息
    this.actionEnter = function(_data)
    {
        global_current_client_id = _data['client_id'];
        if(_data!=null && _data['history_msg']!=null&&_data['history_msg'].length>0){
            for(var i in _data['history_msg']){
                that.agentDistribute(_data['history_msg'][i]);
            }
        }
    };


    this.actionClient_list = function(_data){
        $("#chat_user_list>ul").find("li:not(:first)").remove();
        for(var i in _data.client_list)
        {
            var user = (typeof _data.client_list[i].user == "object") ? _data.client_list[i].user : null;
            var new_li = $(document.createElement("li"));
            var name_span = $(document.createElement('span'));
            if(user)
            {
                name_span.attr({alt:user.intro,"data-uid":user.id}).click(function(){
                    pager.invite({user_id:$(this).attr("data-uid"),nickname:$(this).text()});
                }).mouseover(function(){
                    layer.tips($(this).attr("alt"),this,{tips:1,time:1500});
                });
            }
            name_span.addClass("layui-col-xs7 name_tag").text(user ? user.nickname : "游客").appendTo(new_li);
            $(document.createElement('span')).addClass("layui-col-xs5").text(user ? user.score : "0").appendTo(new_li);
            new_li.appendTo($("#chat_user_list>ul"));
        }
    };

    this.actionGame_info = function(_data){
        board.load(_data.game);
    };

    // 接收发言消息
    this.actionSay = function(_data){
        pager.show_msg("<span>" + _data.from_user.nickname +  "</span> 说：<span>" + _data.content + "</span>");
    };

    this.actionGames = function(_data)
    {
        pager.show_game_list(_data.games);
    };


    //系统公告
    this.actionGlobal_announce = function(_data){
    };

    this.actionInvite = function(_data){
        pager.invite(_data.invite);
    };

    this.actionGame_start = function(_data){
        window.location.href = "/game/" + _data.game_id;
    };

    // 用户退出 更新用户列表
    this.actionLogout = function(_data){
        debug_log(_data);
    };

    this.actionNotice = function(_data){
        pager.show_msg(_data.content);
    };

    this.actionShutdown = function(_data)
    {
        //正常业务结束，服务器端要求关闭并且不再重连
        //if(typeof shutdownCallback == 'function') shutdownCallback(_data);
        ws.onclose = function () {
            return false;
        };
        global_current_client_id = '';
        ws.close();
    }
};

var  _chat={
    chatObj:null,
    getChat:function(){
        if(this.chatObj==null)this.chatObj = new chat();
        return this.chatObj;
    }
};
_chat.getChat().connect();
