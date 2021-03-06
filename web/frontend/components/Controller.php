<?php
/**
 * Created by PhpStorm.
 * User: user
 * Date: 11/8/2017
 * Time: 17:38
 */

namespace frontend\components;


use common\models\Player;

class Controller extends \yii\web\Controller
{
    private $user = null;
    protected function renderJSON($data=[], $msg ="ok", $code = 200)
    {
        header('Content-type: application/json');
        echo json_encode([
            "code" => $code,
            "msg"   =>  $msg,
            "data"  =>  $data,
            "req_id" =>  uniqid(),
        ]);

        return \Yii::$app->end();
    }

    protected function renderJSONP($data=[], $msg ="ok", $code = 200) {

        $func = $this->get("jsonp","jsonp_func");

        echo strip_tags($func)."(".json_encode([
                "code" => $code,
                "msg"   =>  $msg,
                "data"  =>  $data,
                "req_id" =>  uniqid(),
            ]).")";

        return \Yii::$app->end();
    }


    public function post($key, $default = "") {
        return \Yii::$app->request->post($key, $default);
    }


    public function get($key, $default = "") {
        return \Yii::$app->request->get($key, $default);
    }

    public function _user()
    {
        if(!$this->user && !\Yii::$app->user->isGuest)
        {
            $this->user = Player::findOne(\Yii::$app->user->getId());
        }
        return $this->user;
    }
}