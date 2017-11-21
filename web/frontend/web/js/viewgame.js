/**
 * @author xsir317@gmail.com
 * @license http://creativecommons.org/licenses/by-sa/3.0/deed.zh
 */
var boardObj = function()
{
    //棋盘的DOM对象，基本上棋子、棋盘逻辑都在这里面。
    var board = $("#board_main");

    var _obj = this;

    //整个游戏的数据结构，包括对局进程、状态、双方等等。会通过页面变量或者Websocket推过来。
    _obj.gameData = {};

    //字符串，当前局面记录。
    _obj.currgame = '';

    //字符串，记录终局状态。
    _obj.endgame = '';

    // 当前颜色，在初始化时会初始化为黑色
    _obj.curr_color = 'black';

    //当前手数，会被初始化为1
    _obj.curr_step = 1;

    //以下两个变量表示“是否是我参与的游戏”、“当前是否轮到我下棋”
    _obj.is_my_game = false;
    _obj.is_my_turn = false;

    //load 一个游戏数据。
    _obj.load = function( game_data ){
        _obj.gameData = game_data;
        _obj.show_origin();
    };

    //setInterval就存在这里，初始化的时候clear一下
    //_obj.timer_handler = 0;

    /**
     * 用于展示时间。 如果对局正在进行，还会负责进行倒计时的显示。
     * 这是一个闭包结构。timer_handler在闭包里。
     */
    _obj.timer = (function(){
        var timer_handler = 0;

        return (function(){
            //首先，获取当前时间，当前游戏的双方剩余时间
            var render_time = function(seconds,player)
            {
                seconds = (seconds > 0) ? seconds : 0;
                var hours = parseInt(seconds/3600).toString();
                if(hours.length == 1) {hours = '0' + hours}
                var minutes = parseInt( (seconds%3600) /60).toString();
                if(minutes.length == 1) {minutes = '0' + minutes}
                var seconds_display = parseInt(seconds % 60).toString();
                if(seconds_display.length == 1) {seconds_display = '0' + seconds_display}

                var display_obj = player ? $("#black_time_display") : $("#white_time_display");
                display_obj.html(hours + ':' + minutes + ':' + seconds_display);
            };

            // 记录当前时间。
            var timer_start = new Date().getTime();
            //先render双方时间显示
            render_time(_obj.gameData.black_time,1);
            render_time(_obj.gameData.white_time,0);
            //如果对局进行中，那么 setInterval 每一秒钟，计算开始时间到当前过了多久；用行棋方时间减去已用时间，再次render。
            //如果对局正在进行中
            if(timer_handler)
            {
                debug_log("we do cleared " + timer_handler + ". we will set up new Interval if needed.");
                clearInterval(timer_handler);
            }
            if(_obj.gameData.status == 1)
            {
                timer_handler = setInterval(function(){
                    var current = new Date().getTime();

                    var delta_time = current - timer_start;
                    var time_left = (_obj.gameData.turn ? _obj.gameData.black_time : _obj.gameData.white_time) - parseInt(delta_time/1000);
                    render_time(time_left,_obj.gameData.turn);
                },1000);
                debug_log("setInterval " + timer_handler);
            }
        });
    })();

    /**
     * @description 在指定位置放置一枚棋子。当操作者是行棋一方时，会转交给make_move来处理。
     * 当操作者是玩家之一时，不可以拿棋盘来拆棋，只能按照对局记录前进后退。
     * @param  {string} coordinate 传入坐标。
     * @returns {boolean}
     */
    _obj.place_stone = function(coordinate){
        var target_cell = board.find('.'+coordinate);
        if(!target_cell.hasClass('blank'))
        {
            return false;
        }

        //这里的逻辑解释一下： 如果是轮到我下，而且是完全展示棋局的状态，那么就是“落子状态”。
        //如果是落子状态，就可以不按照之前的记录落下新的一个棋子。
        //如果不是落子状态，则对对局双方作出限制：只能按照之前的记录去落子，不能拿这个棋盘来拆棋。
        var playing = (_obj.is_my_turn && _obj.currgame == _obj.gameData.game_record);
        if(_obj.is_my_game && !playing)
        {
            if(coordinate != _obj.endgame.substr(_obj.currgame.length,2))
            {
                return false;
            }
        }
        //是否显示五手N打点： 第四手展示在棋盘上，并且前4手的确是符合记录的时候，显示打点。
        if(_obj.curr_step == 4 && _obj.endgame == _obj.gameData.game_record)
        {
            _obj.show_a5();
        }
        else if(_obj.curr_step == 5)
        {
            _obj.hide_a5();
        }
        target_cell.removeClass('blank').addClass(_obj.curr_color).html(_obj.curr_step ++);
        _obj.curr_color = (_obj.curr_color == 'black' ? 'white':'black');
        _obj.currgame += coordinate;
        if(_obj.currgame != _obj.endgame.substr(0,_obj.currgame.length))
        {
            _obj.endgame = _obj.currgame;
        }

        //最后，如果是落子状态，通知一下服务器。
        if(playing)
        {
            return _obj.make_move(coordinate);
        }

        return true;
    };

    /**
     * @description
     * @param  {string} coordinate 传入坐标。
     * @returns {boolean}
     */
    _obj.make_move = function(coordinate){
        if(!_obj.is_my_turn)
        {
            return false;
        }
        $.post(
            "/games/games/play",
            {
                coordinate:coordinate,
                "_csrf-frontend":$("meta[name=csrf-token]").attr("content"),
                game_id:gameObj.id
            },
            function(_data){
                if(_data.code != 200)
                {
                    alert(_data.msg);
                }
            },
            "json"
        );
        return true;
    };

    /**
     * 右键和回退按钮的事件，往回退一个棋子。并不产生任何Ajax，这不是悔棋操作。
     * @returns {boolean}
     */
    _obj.move_pre = function(){
        if(_obj.currgame)
        {
            var last_move = _obj.currgame.substr(_obj.currgame.length-2,2);
            //这个棋子拿起来。。。
            var target_cell = board.find('.'+last_move);
            target_cell.removeClass('black white').addClass('blank').html('');
            _obj.curr_step --;
            _obj.curr_color = (_obj.curr_color == 'black' ? 'white':'black');
            _obj.currgame = _obj.currgame.substr(0,_obj.currgame.length-2);
            //打点显示
            if(_obj.curr_step == 5 && _obj.endgame == _obj.gameData.game_record)
            {
                _obj.show_a5();
            }
            else if(_obj.curr_step == 4)
            {
                _obj.hide_a5();
            }
            return true;
        }
        return false;
    };

    /**
     * 根据endgame，一步一步走下去，把整个棋局展示出来。
     * @returns {boolean}
     */
    _obj.move_next = function(){
        if(_obj.currgame != _obj.endgame)
        {
            var nextstep = _obj.endgame.substr(_obj.currgame.length,2);
            _obj.place_stone(nextstep);
            return true;
        }
        return false;
    };

    /**
     * 回退到空棋盘状态。
     */
    _obj.board_clean = function(){
        while (_obj.move_pre()) {}
    };

    /**
     * 根据目前的棋局记录一路Next到局面结束的状态。
     */
    _obj.board_end = function(){
        while(_obj.move_next()) {}
    };

    /**
     * 根据gameData 初始化棋盘的文字信息和棋盘Game信息
     */
    _obj.show_origin = function(){
        _obj.render_game_info();

        _obj.board_clean();
        _obj.endgame = _obj.gameData.game_record;
        _obj.board_end();
    };

    /**
     * 展示除了棋盘之外的其他文字信息和对局相关的提示信息。
     * 也负责计算轮到谁落子。
     */
    _obj.render_game_info = function(){
        //计算当前是否是“我”落子的回合。
        _obj.is_my_game = false;
        _obj.is_my_turn = false;
        
        if(userinfo != null)
        {
            _obj.is_my_game = (userinfo.id == _obj.gameData.black_id || userinfo.id == _obj.gameData.white_id);
            _obj.is_my_turn = (_obj.gameData.whom_to_play == userinfo.id);
        }
        $(".black_name>ins").html(_obj.gameData.bplayer.nickname);
        $(".white_name>ins").html(_obj.gameData.wplayer.nickname);
        $(".current_player_name>ins").html(_obj.gameData.turn ? _obj.gameData.bplayer.nickname : _obj.gameData.wplayer.nickname);
        $(".a5_numbers>ins").html(_obj.gameData.wplayer.a5_numbers);
        $(".is_swap>ins").html(_obj.gameData.wplayer.swap ? "是":"否");
        $(".game_result>ins>strong").html(result_defines[_obj.gameData.status]);
        if(_obj.is_my_turn)
        {
            $(".turn_to_play_tips").show();
        }
        else
        {
            $(".turn_to_play_tips").hide();
        }

        if(_obj.is_my_game && _obj.gameData.status == 1)
        {
            $(".draw_button,.resign_button").show();
        }
        else
        {
            $(".draw_button,.resign_button").hide();
        }

        if(_obj.is_my_game && _obj.gameData.status == 1 && _obj.gameData.offer_draw >0 && _obj.gameData.offer_draw != userinfo.id)
        {
            $(".offer_draw_tips").show();
        }
        else
        {
            $(".offer_draw_tips").hide();
        }
        //计时
        _obj.timer();
    };

    /**
     * 显示和隐藏五手打点
     * @returns {boolean}
     */
    _obj.show_a5 = function(){
        if(_obj.gameData.a5_pos == '')
            return false;
        var a5_points = '.' + _obj.gameData.a5_pos.substr(0,2);
        for(var sub = 2;sub<_obj.gameData.a5_pos.length;sub += 2)
        {
            a5_points += ',.';
            a5_points += _obj.gameData.a5_pos.substr(sub,2);
        }
        $(a5_points).addClass('black a5stone').html('▲');
    };
    _obj.hide_a5 = function(){
        $(".a5stone").removeClass('black a5stone').html('');
    };


    /**
     * 画棋盘和按钮。绑定右键事件。
     * 整个页面载入的时候会执行一次。仅此一次。
     */
    _obj.init_board = function(){
        _obj.currgame = '';
        _obj.curr_color = 'black';
        _obj.curr_step = 1;
        board.html('');

        board.mousedown(function(e){
            if(e.which == 3)
            {
                _obj.move_pre();
                return false;
            }
        });
        board.bind("contextmenu", function() { return false; });
        for(var i=1;i<=15;i++)
        {
            //insert a row
            var newrow = $(document.createElement("div"));
            newrow.addClass('row');
            for(var j=1;j<=15;j++)
            {
                //insert a cross point
                var newcell = $(document.createElement("div"));
                newcell.addClass(i.toString(16) + j.toString(16));
                newcell.attr('alt',i.toString(16) + j.toString(16));
                newcell.addClass('blank');
                newrow.append(newcell);
            }
            board.append(newrow);
        }
        board.find('.row div').click(function(){
            _obj.place_stone($(this).attr('alt'));
            return true;
        });
        //生成控制按钮
        var controlbar = $(document.createElement("div"));
        controlbar.addClass('controlbar');
        board.after(controlbar);
        //按钮
        $(document.createElement("button")).addClass('button').text('前一手')  .click(_obj.move_pre   ).appendTo(controlbar);
        $(document.createElement("button")).addClass('button').text('后一手')  .click(_obj.move_next  ).appendTo(controlbar);
        $(document.createElement("button")).addClass('button').text('第一手')  .click(_obj.board_clean).appendTo(controlbar);
        $(document.createElement("button")).addClass('button').text('最后一手').click(_obj.board_end  ).appendTo(controlbar);
        $(document.createElement("button")).addClass('button').text('恢复')    .click(_obj.show_origin).appendTo(controlbar);
    };
};

//页面初始化时对棋盘的操作：
//1.new出对象
var board = new boardObj();
//2.调用其init方法
board.init_board();
//3.把web页输出的数据结构load进来。
board.load(gameObj);

$("#chat_operate_area .send").click(function(){
    var content = $("#msg").val().trim();
    if(!content)
    {
        alert("请勿发送空信息");
    }
    $.post(
        "/games/chat/say",
        {
            content:content,
            "_csrf-frontend":$("meta[name=csrf-token]").attr("content"),
            game_id:gameObj.id
        },
        function(_data){
            if(_data.code != 200)
            {
                alert(_data.msg);
            }
            $("#msg").val("");
        },
        "json"
    );
});
