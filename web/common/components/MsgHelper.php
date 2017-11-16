<?php
/**
 * Created by PhpStorm.
 * User: user
 * Date: 2016/10/10
 * Time: 18:25
 */

namespace common\components;


class MsgHelper
{
    public static function build($type,$params=[])
    {
        if($type && is_callable('self::build'.ucfirst($type)))
        {
            $result = call_user_func('self::build'.ucfirst($type),$params);
            $result['msg_id'] = self::msg_id();
        }
        else
        {
            throw new MsgException('不支持的消息类型');
        }
        return json_encode($result);
    }
    public static function persist($room_id,$data)
    {
        //TODO 塞个别的队列啥的。。。 用于分析，这里放redis是用于用户显示历史消息
        return \Yii::$app->redis->zAdd(
            self::getRoomMsgKey($room_id),
            self::getRoomMsgId($room_id),
            $data
        );
    }

    public static function getRecentMsgs($room_id)
    {
        $return =  \Yii::$app->redis->zRange(
            self::getRoomMsgKey($room_id),
            -10,
            -1
        );
        foreach ($return as &$item)
        {
            $item = @json_decode($item,1);
        }
        return $return;
    }

    private static function buildShutdown($params)
    {
        $content = '内部错误，请刷新网页';
        if(!empty($params['content']) && is_string($params['content']))
        {
            $content = $params['content'];
        }
        return [
            'type' => 'shutdown',
            'content' => $content
        ];
    }

    private static function buildClient_list($params)
    {
        if(!isset($params['client_list']) || !is_array($params['client_list']))
        {
            throw new MsgException('参数不完整，需要client_list');
        }
        return [
            'type' => 'client_list',
            'client_list' => $params['client_list']
        ];
    }


    private static function buildEnter($params)
    {
        if(!isset($params['client_id']) || !is_string($params['client_id']))
        {
            throw new MsgException('参数不完整，需要client_id');
        }
        return [
            'type' => 'enter',
            'client_id' => $params['client_id'],
            'history_msg' => empty($params['history_msg']) ? [] : $params['history_msg']
        ];
    }

    private static function buildLogin($params)
    {
        if(empty($params['user']))
        {
            throw new MsgException('参数不完整，需要user');
        }
        return [
            'type' => 'login',
            'user' => $params['user'],
            'time' => date('Y-m-d H:i:s'),
        ];
    }

    private static function buildNotice($params)
    {
        if(empty($params['content']))
        {
            throw new MsgException('缺少提示内容');
        }

        return [
            'type' => 'notice',
            'content' => $params['content']
        ];
    }

    private static function buildGift_banner($params)
    {
        if(empty($params['from']))
        {
            throw new MsgException('缺少参数from_client');
        }
        if(empty($params['banner_id']))
        {
            throw new MsgException('缺少banner_id');
        }

        return [
            'type' => 'gift_banner',
            'banner_id' => $params['banner_id'],
            'from' => $params['from'],
            'to' => empty($params['to']) ? null:$params['to'],
            'time' => date('Y-m-d H:i:s'),
        ];
    }

    private static function buildSay($params)
    {
        if(empty($params['from_client']))
        {
            throw new MsgException('缺少参数from_client');
        }
        if(empty($params['to_client']))
        {
            throw new MsgException('缺少参数to_client');
        }
        if(empty($params['content']))
        {
            throw new MsgException('缺少参数content');
        }
        $return = [
            'type' => 'say',
            'from_client' => $params['from_client'],
            'to_client' => $params['to_client'],
            'content' => $params['content'],
            'scope' => isset($params['scope']) && in_array($params['scope'],['public','private']) ? $params['scope'] : 'public',
            'time' => date('Y-m-d H:i:s'),
        ];
        //默认颜色和字体
        if(!empty($params['color']) && preg_match('/^#[0-9a-f]{6}$/i',$params['color']))
        {
            $return['color'] = $params['color'];
        }
        if(!empty($params['font-size']) && intval($params['font-size']))
        {
            $font_size = intval($params['font-size']);
            if($font_size >=8 && $font_size <= 40)
            {
                $return['font-size'] = $font_size;
            }
        }
        return $return;
    }

    private static function buildBroadcast($params)
    {
        if(empty($params['content']))
        {
            throw new MsgException('缺少参数content');
        }
        if(empty($params['author']))
        {
            throw new MsgException('缺少参数author');
        }
        $return = [
            'type' => 'broadcast',
            'content' => $params['content'],
            'author' => $params['author'],
            'time' => date('Y-m-d H:i:s'),
        ];
        return $return;
    }


    private static function buildGlobal_announce($params)
    {
        if(empty($params['user']))
        {
            throw new MsgException('缺少参数user');
        }
        if(empty($params['content']))
        {
            throw new MsgException('缺少参数content');
        }

        return [
            'type' => 'global_announce',
            'room_id' => isset($params['room_id']) ? $params['room_id']:0,
            'user' => $params['user'],
            'content' => $params['content'],
            'time' => date('Y-m-d H:i:s'),
        ];
    }

    private static function buildLogout($params)
    {
        if(empty($params['client']))
        {
            throw new MsgException('参数不完整，缺少client');
        }
        if(!isset($params['client_list']))
        {
            throw new MsgException('参数不完整，缺少client_list');
        }

        return [
            'type' => 'logout',
            'client' => $params['client'],
            'client_list' => $params['client_list'],
            'time' => date('Y-m-d H:i:s')
        ];
    }

    private static function buildGame_info($params)
    {
        if(!isset($params['game']))
        {
            throw new MsgException('参数不完整，缺少game游戏信息');
        }
        return [
            'type' => 'game_info',
            'game' => $params['game']
        ];
    }

    private static function getRoomMsgKey($room_id)
    {
        return sprintf("room_msg::%d",$room_id);
    }

    private static function getRoomMsgId($room_id)
    {
        return \Yii::$app->redis->hIncrBy("room_incr_msg",$room_id,1);
    }

    private static function msg_id()
    {
        return \Yii::$app->redis->incr("global_msg_id");
    }
}

class MsgException extends \Exception
{

}