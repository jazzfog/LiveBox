# (Deprecated) LiveBox - A jQuery Lightbox Plugin

**Warning: The project is deprecated, use at your wown risk**

## Key features

- Clear documentation full of editable demos
- Supports variety of content types, such as html, images, video, iframe, ajax and others
- Drag&drop and auto resize
- Overlaying LiveBoxes (open one on top of another)
- API for controlling LiveBox, including resizing and catching events
- Chaining content (slideshow) including mixed content
- Image preloading
- Highly customizable look
- JavaScript knowledge not required

#### Install

    bower install livebox
    
If you do not use [bower](http://bower.io) you can [download files](https://github.com/jazzfog/LiveBox/archive/master.zip) from this repository and include it in your project.

#### Some examples

Simple HTML

```javascript
$(function () {

    $.livebox({
        type: 'html',
        content: 'Hello, World!'
    });
});
```

Content from DOM element, reaction on event

```javascript
$(function () {

    $.livebox({
        content: '#divWithContent',
        width: 500,
        height: 300,
        events: {
            show: function () {
                console.log('Window is open')
            }
        }
    });
});
```

Full documentation and demos on website - [liveboxjs.com](http://liveboxjs.com)
