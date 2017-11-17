<?php
/**
 * Created by PhpStorm.
 * User: user
 * Date: 11/12/2017
 * Time: 15:55
 */

namespace common\services;


use common\models\Games;
use common\models\Player;

class GameService extends BaseService
{
    /**
     * @param int $game_id
     * @return mixed
     */
    public static function renderGame($game_id)
    {
        $game = Games::findOne($game_id);
        if(!$game)
        {
            return null;
        }
        //turn
        $turn = 0;
        $stones = strlen($game->game_record)/2 ;
        if($stones < 3)
        {
            $turn = 1;
        }
        elseif($stones == 4 && $game->a5_numbers == (strlen($game->a5_pos)/2))//打点摆完了
        {
            $turn = 0;
        }
        else
        {
            $turn = 1 - ($stones%2);
        }
        //刷时间。
        $lastupd = strtotime($game->updtime);
        $delta = time() - $lastupd;
        if($turn)
        {
            $game->black_time -= $delta;
            $game->black_time = ($game->black_time < 0 ? 0 : $game->black_time);
            if($game->black_time == 0)
            {
                $game->movetime = date('Y-m-d H:i:s');
                //BoardTool::do_over($game,0);
            }
        }
        else
        {
            $game->white_time -= $delta;
            $game->white_time = ($game->white_time < 0 ? 0 : $game->white_time);
            if($game->white_time == 0)
            {
                $game->movetime = date('Y-m-d H:i:s');
                //BoardTool::do_over($game,1);
            }
        }
        $game->updtime = date('Y-m-d H:i:s');
        $game->save(0);
        //do over
        $return  = $game->toArray();
        $return['bplayer'] = self::renderUser($game->black_id);
        $return['wplayer'] = self::renderUser($game->white_id);
        $return['turn'] = $turn;
        return $return;
    }

    public static function renderUser($uid)
    {
        $user = $uid ? Player::findOne($uid) : null;
        return $user ? [
            'id' => $user->id,
            'email' => $user->email,
            'nickname' => $user->nickname,
            'score' => $user->score,
            'intro' => $user->intro,
        ] : null;
    }

    public static function newToken()
    {
        $return = [];
        $return['token'] = \Yii::$app->security->generateRandomString();
        $return['secret'] = \Yii::$app->security->generateRandomString();
        \Yii::$app->redis->setEx($return['token'],600,$return['secret']);
        \Yii::$app->session['chat_token'] = $return['token'];
        return $return;
    }
}