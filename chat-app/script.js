let sendChat = (str) => {
    let data = new FormData();

    console.log(data.get('json'));

    fetch('./', {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            m: 'a',
            message: str
        })
    });
}

// sendChat('hello');


window.onload = () => {
    $('#chat-enter').on('click', evt => {
        let txt = $('#chat-box').val();
        $('#chat-box').val('');
        sendChat(txt);
    });
}
