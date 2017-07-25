const Telegraf = require( 'telegraf' ),
      Token = process.env.BOT_TOKEN || '',
      Bot = new Telegraf( Token );

const deleteIt = ( msg ) => {
    Bot.telegram.deleteMessage( msg.chat.id, msg.message_id );
};

const isAdmin = async ( chat, user ) => {
    try {
        var status = await Bot.telegram.getChatMember( chat, user );
        if ( ! status ) return false;
        if ( status.status == 'creator' || status.status == 'administrator' ) return true;
        return false;
    } catch( e ) {
        return false;
    }
};

const escapeHTML = ( str ) => {
    var out = str.replace( /</g, '&lt;' );
    out = out.replace( />/g, '&gt;' );
    out = out.replace( /&/g, '&amp;' );
    out = out.replace( /"/g, '&quot;' );
    return out;
};

const buildName = ( from ) => {
    if ( from.username )
        return `<a href="https://t.me/${from.username}">${escapeHTML(from.first_name)}</a>`;
    else
        return from.first_name;
};

Bot.telegram.getMe().then( ( profile ) => {
    global.my_id = profile.id;
} );

Bot.command( 'start', ( ctx ) => {
    if ( ctx.chat.type == 'private' )
        ctx.replyWithHTML( 'ربات <b>Micro Drone</b>. از @ehsaan_me' );
    else
        deleteIt( ctx.message );
} );

Bot.on( 'channel_post', ( ctx ) => {
    ctx.leaveChat();
} );

Bot.hears( /\/gag(.*)/, async ( ctx ) => {
    if ( ! await isAdmin( ctx.chat.id, ctx.from.id ) ) return deleteIt( ctx.message );

    var mins = +ctx.match[1].trim();
    if ( ! mins || mins < 0 || mins > 60 ) mins = 5;

    var target = ctx.message.reply_to_message;
    if ( ! target ) return deleteIt( ctx.message );
    if ( target.from.id == ctx.from.id ) return deleteIt( ctx.message );
    if ( await isAdmin( ctx.chat.id, target.from.id ) ) return deleteIt( ctx.message );

    var until = Math.floor( new Date() / 1000 ) + ( mins * 60 );
    Bot.telegram.restrictChatMember( ctx.chat.id, target.from.id, {
        can_send_messages:              false,
        until_date:                     until
    } );

    deleteIt( ctx.message );
    ctx.replyWithHTML( `کاربر ${buildName(target.from)} به مدت <b>${mins}</b> دقیقه از ارسال هر گونه پیام توسط ادمین ${buildName(ctx.from)} منع گردید.`, {
        disable_web_page_preview:           true
    } );
} );

Bot.hears( 'لینک گروه', async ( ctx ) => {
    try {
        var chatLink = await ctx.exportChatInviteLink();
        var thisChat = await ctx.telegram.getChat( ctx.chat.id );

        ctx.replyWithHTML( `گروه <b>${thisChat.title}</b>
<a href="${chatLink}">عضویت در این گروه</a>`, {
            reply_to_message_id:        ctx.message.message_id
        } ).then( ( sent ) => {
           setTimeout( () => {
                deleteIt( sent );
                deleteIt( ctx.message );
           }, 10000 ); 
        } );
    } catch( e ) {
        //...
    } 
} );

Bot.hears( /#موقت/, async ( ctx ) => {
    if ( ! await isAdmin( ctx.chat.id, ctx.from.id ) ) return deleteIt( ctx.message );

    setTimeout( () => {
        deleteIt( ctx.message );
    }, 10000 );
} );

// RESTRICT CONTENTS & USERS
Bot.use( async ( ctx, next ) => {
    var chat_id = ctx.chat.id, user_id = ctx.from.id;
    try {
        if ( await isAdmin( chat_id, user_id ) ) return;
        if ( user_id == my_id ) return;
        ctx.telegram.restrictChatMember( chat_id, user_id, {
            can_send_messages:                      true,
            can_send_media_messages:                true,
            can_send_other_messages:                false,
            can_add_web_page_previews:              false
        } );
        next();
    } catch( e ) {
        console.log( e );
    }
} );

Bot.on( 'message', ( ctx, next ) => {
    var new_members = ctx.message.new_chat_members;
    if ( ! new_members ) return next();

    deleteIt( ctx.message );
    for ( var member of new_members ) {
        if ( member.id == my_id ) continue;
        if ( member.username && member.username.toLowerCase().substr( -3, 3 ) == 'bot' ) {
            ctx.telegram.kickChatMember( ctx.chat.id, member.id );
        }
    }
} );

Bot.on( [ 'sticker', 'video_note', 'voice' ], ( ctx ) => {
    deleteIt( ctx.message );
} );

Bot.on( 'document', ( ctx ) => {
    if ( ctx.message.document.mime_type == 'video/mp4' )
        deleteIt( ctx.message );
} );

Bot.hears( [ /t\.me/, /telegram\.me/ ], ( ctx ) => {
    deleteIt( ctx.message );
} );

Bot.on( 'text', async ( ctx ) => {
    var ents = ctx.message.entities || [];
    for ( var ent of ents ) {
        if ( ent.type && ent.type == 'mention' ) {
            var mentioned = ctx.message.text.substr( ent.offset, ent.length );
            try {
                var chat = await ctx.telegram.getChat( mentioned );
                if ( chat && chat.type == 'channel' ) {
                    deleteIt( ctx.message );
                    break;
                }
            } catch( e ) {
                console.log( e );
            }
        }
    }
} );

Bot.on( 'message', async ( ctx, next ) => {
    if ( ctx.message.forward_from_chat && ctx.message.forward_from_message_id )
        return deleteIt( ctx.message );

    if ( ctx.message.caption ) {
        var caption = ctx.message.caption;
        if ( /t(?:elegram)?\.me/.test( caption ) ) return deleteIt( ctx.message );

        var regex = /(@[A-Z]*[a-z]*[0-9]*[_]*)/g;
        var usernames = caption.match( regex );
        
        for ( var username of usernames ) {
            try {
                var chat = await ctx.telegram.getChat( username );
            } catch( e ) {
                continue;
            }

            if ( chat && chat.type == 'channel' ) {
                deleteIt( ctx.message );
                break;
            }
        }
    }
} );

Bot.on( 'edited_message', async ( ctx, next ) => {
    var msg = ctx.update.edited_message,
        text = msg.caption || msg.text || '';
    
    if ( /t(?:elegram)?\.me/.test( text ) ) return deleteIt( msg );

    var regex = /(@[A-Z]*[a-z]*[0-9]*[_]*)/g;
    var usernames = text.match( regex );
    
    for ( var username of usernames ) {
        try {
            var chat = await ctx.telegram.getChat( username );
        } catch( e ) {
            continue;
        }

        if ( chat && chat.type == 'channel' ) {
            deleteIt( msg );
            break;
        }
    }
} );

Bot.startPolling();
