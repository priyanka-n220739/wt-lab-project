function createEvent(){

let name=document.getElementById("name").value
let date=document.getElementById("date").value
let venue=document.getElementById("venue").value
let category=document.getElementById("category").value
let description=document.getElementById("description").value
let limit=document.getElementById("limit").value

let events=JSON.parse(localStorage.getItem("events"))||[]

events.push({
name,
date,
venue,
category,
description,
limit
})

localStorage.setItem("events",JSON.stringify(events))

alert("Event Created Successfully")

}
function loadEvents(){

let container=document.getElementById("events")

if(!container) return

let events=JSON.parse(localStorage.getItem("events"))||[]

events.forEach((e,i)=>{

let div=document.createElement("div")

div.className="event"

div.innerHTML=`
<h3>${e.name}</h3>
<p>Date: ${e.date}</p>
<p>Venue: ${e.venue}</p>
<button onclick="deleteEvent(${i})">Delete</button>
`

container.appendChild(div)

})

}

function deleteEvent(index){

let events=JSON.parse(localStorage.getItem("events"))

events.splice(index,1)

localStorage.setItem("events",JSON.stringify(events))

location.reload()

}

function registerStudent(){

let name=document.getElementById("student").value
let event=document.getElementById("event").value

let data=JSON.parse(localStorage.getItem("registrations"))||[]

data.push({name,event})

localStorage.setItem("registrations",JSON.stringify(data))

alert("Registered Successfully")

}

function loadParticipants(){

let table=document.getElementById("table")

if(!table) return

let data=JSON.parse(localStorage.getItem("registrations"))||[]

data.forEach(d=>{

let row=table.insertRow()

row.insertCell(0).innerHTML=d.name
row.insertCell(1).innerHTML=d.event

})

}