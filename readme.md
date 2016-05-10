# LiveBox - A jQuery Lightbox Plugin

Be aware of *beta* version

## Key features

- Supports variety of content types, such as html, images, video, maps, iframe, ajax and others
- Drag&drop and auto resize
- Open one LiveBox on top of another
- API for controlling livebox, including resizing and catching events
- Chaining LiveBoxes with mixed content
- Image preloading
- Highly customizable look
- Ability to preserve event handlers when you use hidden element on page as source for LiveBox html content

#### Some examples

Simple HTML

    $(function () {

        var handler = $.fn.livebox({
            type: 'html',
            content: 'Hello, World!'
        });
    });

Content from DOM element, reaction on event

    $(function () {

        var handler = $.fn.livebox({
            type: 'selector',
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

Real documentation and examples is on the go