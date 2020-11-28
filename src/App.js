import React from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import Matter from "matter-js";

const monday = mondaySdk();
var completedIDs = [];

// module aliases
var Engine = Matter.Engine,
Render = Matter.Render,
World = Matter.World,
Bodies = Matter.Bodies,
Events = Matter.Events,
MouseConstraint = Matter.MouseConstraint,
Mouse = Matter.Mouse;

var engine,
render;
var crates = [];

const particleColors = [
    getComputedStyle(document.documentElement).getPropertyValue("--particle_1"),
    getComputedStyle(document.documentElement).getPropertyValue("--particle_2"),
    getComputedStyle(document.documentElement).getPropertyValue("--particle_3"),
    getComputedStyle(document.documentElement).getPropertyValue("--particle_4")
];

class App extends React.Component {

    constructor(props) {
        super(props);

        // Default state
        this.state = { info_text: "", button_text: "Launch Now!", settings: { completed_state: "Done", countdown: 10 }, };
    }

    componentDidMount() {
        this.setupMatterJS();

        //Load boards listener
        monday.listen("context", this.getContext)

        // Settings changed listener
        monday.listen("settings", this.getSettings);
    }

    render() {
        return <div className="App" ref="launch_site">
            <div className="button_container">
                <p className="launch_title" id="title">{this.state.info_text}</p>
                <button id="launchButton" onClick={this.prepareLaunch} className="launch_button">{this.state.button_text}</button>
            </div>
            <img src="sprites/mocket.png" alt="Rocket Stationed" id="rocketStationed" className="rocket_stationed"></img>
            <p id="hover_label">Hover</p>
            <div className="particle_container" id="particleContainer"></div>
            <img alt="Rocket" className="rocket" id="rocket" src="sprites/mocket.png"></img>
        </div>;
    }

    getContext = (res) => {
        this.setState({context: res.data});
        this.loadCompletedItems();
    }

    getSettings = (res) => {
        if (!(isNaN(parseInt(res.data.countdown)))) {
            console.log("Setting countdown to: " + parseInt(res.data.countdown));
            this.setState({ settings: { countdown: parseInt(res.data.countdown) }})
        }
        if (res.data.completed_state !== "") {
            this.setState({ settings: { completed_state: res.data.completed_state } });
            this.loadCompletedItems();
        }
    }

    loadCompletedItems = () => {
        for (var i in this.state.context.boardIds) {
            monday.api(`query ($completedState: String!, $boardID: Int!) { items_by_column_values (board_id: $boardID, column_id: "status", column_value: $completedState) { name id } }`, {
                    variables: {completedState: this.state.settings.completed_state, boardID: this.state.context.boardIds[i]}
                })
                .then(res => {
                    this.clearCrates();
                    for (var i in res.data.items_by_column_values) {
                        this.createBox(res.data.items_by_column_values[i].name);
                        completedIDs[completedIDs.length] = res.data.items_by_column_values[i].id;
                    }
                    this.setState({info_text: completedIDs.length + " items ready to launch"})
            });
        }
    }

    createBox(name) {
        let x = getRandomInt(400, 800);
        let y = getRandomInt(50, 400);
        let size = getRandomInt(50, 70);

        let crate = Bodies.rectangle(x, y, size, size, {
            render: {
                sprite: {
                    texture: "/sprites/crate.png",
                    xScale: size / 475,
                    yScale: size / 475 } },
            label: name
        });
            
        World.add(engine.world, [crate]);
        crates[crates.length] = crate;
    }

    setupMatterJS = () => {
        engine = Engine.create();

        // create a renderer
        render = Render.create({
            element: this.refs.launch_site,
            engine: engine,
            options: {
                wireframes: false,
                background: '#fff',
                width: window.innerWidth,
                height: window.innerHeight - 100
            }
        });

        var ground = Bodies.rectangle(window.innerWidth / 2 - 250, window.innerHeight - 100, window.innerWidth + 500, 20, { 
            isStatic: true,
            render: { fillStyle: '#fff' }
        });

        var mouse = Mouse.create(render.canvas),
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: false }
            }
        });

        World.add(engine.world, [ground, mouseConstraint]);
        Engine.run(engine);
        Render.run(render);
        
        Events.on(engine, 'tick', () => {
            var mousePosition = mouse.position;
            var cratesUnderMouse = Matter.Query.point(crates, {x: mousePosition.x, y: mousePosition.y});
            
            const label = document.getElementById("hover_label");
            if (cratesUnderMouse.length > 0) {
                let crate = cratesUnderMouse[0];
                label.innerHTML = crate.label;
                label.style.top = crate.position.y - 1 - label.clientHeight + "px";
                label.style.left = crate.position.x - (label.clientWidth + 1) / 2 + "px";
                label.style.opacity = 1;
            } else {
                label.style.opacity = 0;
            }
        });
    }

    prepareLaunch = () => {
        if (completedIDs.length === 0) {
            monday.execute("notice", {
                type: "error",
                message: "Rocket can't be launched without any items!",
                timeout: 2000
            });
            return;
        }
        monday.execute("confirm", {
            message: "Are you sure?\n This will launch all completed items off the earth's atmosphere to the archive!", 
            confirmButton: "Launch!", 
            cancelButton: "Cancel", 
            excludeCancelButton: false
         }).then((res) => {

             if (res.data.confirm) {
                this.deleteCompleted();
                this.clearCrates();
                var launchButton = document.getElementById("launchButton");
                document.getElementById("rocketStationed").style.display = "none";

                launchButton.classList.add("countdown");
                document.getElementById("rocket").style.display = "block";
                this.setState({info_text: "Rocket launching in..."})

                var count = parseInt(this.state.settings.countdown);
                launchButton.innerHTML = count;
                for (var i = 1; i <= parseInt(this.state.settings.countdown); i ++) {
                    setTimeout(() => {
                        count --;
                        launchButton.innerHTML = count;
                        launchButton.classList.add("big");
                        setTimeout( () => { launchButton.classList.remove("big")}, 170);
                        if (count === 0) { this.launch(); }
                    }, i * 1000);
                }
        
             }
         });
    }

    launch = () => {
        var rocket = document.getElementById("rocket");
        rocket.style.animation = "shake 0.3s 10";
        rocket.style.bottom = window.innerHeight + 20 + "px";
        document.getElementById("particleContainer").style.display = "block";
    
        for (let i = 0; i < window.innerHeight * 1.2; i += window.innerHeight / 50) {
            setTimeout(() => {
                var x = window.innerWidth / 2;
                var y = window.innerHeight - i;
                this.createParticle(x, y);
            }, i * 2.2);
        }
        setTimeout( () => {
            monday.execute("notice", { 
                message: "Rocket successfully launched! Items are now archived!",
                type: "success",
                timeout: 2000,
             });
             setTimeout( () => { this.reset() }, 1500);
        }, 2000);
    }

    reset = () => {
        this.loadCompletedItems();
        var launchButton = document.getElementById("launchButton");
        var rocket = document.getElementById("rocket");
        launchButton.classList.remove("countdown");
        launchButton.innerHTML = "Launch now!"
        rocket.style.bottom = "10%";
        rocket.style.display = "none";
        rocket.style.animation = "";
        document.getElementById("particleContainer").style.display = "none";
        document.getElementById("rocketStationed").style.display = "block";
        this.setState({info_text: "0 items ready to launch!"})
    }

    createParticle = (x, y) => {
        let particle = document.createElement("div");
        particle.classList.add("particle");
    
        let size = (Math.random() + 4) * 5;
        let color = particleColors[getRandomInt(0, particleColors.length - 1)];
    
        particle.style.width = size + "px";
        particle.style.height = size + "px";
        particle.style.borderRadius = size + "px";
        particle.style.backgroundColor = color;
    
        let destinationX = x + Math.ceil(Math.random() * 150) * (Math.round(Math.random()) ? 1 : - 1)
        let destinationY = y + ((Math.random() + 15) * 10);
    
        document.getElementById("particleContainer").appendChild(particle);
        let animation = particle.animate(
            [{
                    transform: "translate(-50%, -50%) translate(" + x + "px, " + y + "px) scale(1, 1)",
                    opacity: 1,
                },{
                    transform: "translate(" + destinationX + "px," + destinationY + "px) scale(2, 2)",
                    opacity: 1,
                },],
                {
                duration: Math.random() * 1000 + 1000,
                easing: "cubic-bezier(.05,.58,.33,1)",
                delay: Math.random() * 200,
            }
        );
        animation.onfinish = () => {particle.remove(); };
    }
        
    deleteCompleted = () => {
        for (let i in completedIDs) {
            let itemID = parseInt(completedIDs[i]);
            monday.api(`mutation ($itemID: Int) { archive_item (item_id: $itemID) { id } }`, {
                variables: {itemID: itemID } }
            );
        }
    }
    
    clearCrates = () => {
        for (let i in crates) { World.remove(engine.world, crates[i]) }
        crates = [];
        completedIDs = [];
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default App;
