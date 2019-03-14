(function(global) {
    const DEBUG = false;
    var debug = DEBUG ? console.log.bind(console) : function(){};
    var reg = /(\-|\+)?\d+(\.\d+)?px/gi;// 样式里面的字母是不区分大小写的


    function replaceTag(wxss) {
        return wxss
            .replace(/page/g, 'body');
    }

    global.wxss2css = function wxss2css(wxss) {
        wxss = replaceTag(wxss);

        wxss = wxss.replace(/(\-|\+)?\d+(\.\d+)?rpx/gi,function ( $1 ){
            // rpx值 除以 100
            return Number($1.replace("rpx","")) / 100 + " rem"
        });
        return wxss
    };

})(this);