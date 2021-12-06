
const ShowCase=function(showCaseEl){
	console.log("Init showcase for",showCaseEl);
	const mode=showCaseEl.getAttribute("mode");


	this.getYoutubeVideos=()=>{
		const els = showCaseEl.querySelectorAll("iframe.youtubeVid");
		return els;
	};

	this.getVideos=()=>{
		const els = showCaseEl.querySelectorAll("video");
		return els;
	};


	this.getImages=()=>{
		const els = showCaseEl.querySelectorAll(".cover:not(.blur)");
		return els;
	};

	this.showPlayButton=(v)=>{
		const playButton=showCaseEl.querySelector("#playButton");
		if(playButton){
				playButton.style.display=v?"flex":"none";
		}
	}
	this.playCurrent=()=>{
		if(mode=="gallery"){
			this.getImages().forEach(el=>{
				if(!el.getAttribute("enableRequestFullScreen")){
					el.setAttribute("enableRequestFullScreen",true);
                    const fullscreen=document.createElement("i");
                    fullscreen.classList.add("fas");
                    fullscreen.classList.add("fa-compress");
                    fullscreen.classList.add("maximize");
					el.prepend(fullscreen);

					fullscreen.addEventListener("click", () => {
						if (!document.isFullScreen && !document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
							el.requestFullscreen();
						}else{
							document.exitFullscreen();
						}
						
					});
				}
				el.classList.add("gallery")
			});
				
		}else{
			this.getImages().forEach(el=>el.classList.remove("gallery"));
		}

		lazyLoad(showCaseEl);

		let showPlayButton=false;
		this.getVideos().forEach(el=>{
		
			if(isVisible(el)){
				if(mode=="gallery"){
					showPlayButton=true;
					el.classList.add("gallery");
					el.volume=1.0;
					el.muted = false;
					el.controls=true;
					el.loop=false;
					if(!el.getAttribute("enableHidePlayButtonOnPlay")){
						el.setAttribute("enableHidePlayButtonOnPlay",true);
						el.addEventListener("play",()=>this.showPlayButton(false));
					}
				}else{
					el.classList.remove("gallery");
					el.muted = true;
					el.controls=false;
					el.loop=true;
					el.play();

				}
			}else{
				console.log("Disable video",el);
				el.pause();
			} 
		});

		this.showPlayButton(showPlayButton);



		this.ytReloadInc=0;
		this.getYoutubeVideos().forEach(el=>{
			let osrc=el.getAttribute("osrc");
			if(!osrc){
				const src=el.getAttribute("src");
				if(!src)return;
				osrc=src;
				el.setAttribute("osrc",osrc);
			}
			if(isVisible(el)){
				if(mode=="gallery"){
					el.src = osrc+"?controls=1&autoplay=0&mute=0&modestbranding=1&disablekb=1&"+(this.ytReloadInc++);
				}else{
					el.src = osrc+"?controls=0&autoplay=1&mute=1&modestbranding=1&disablekb=1&"+(this.ytReloadInc++);
				}
			}else{
				el.src = osrc+"?"+(this.ytReloadInc++);
			} 
		});

	};

	


	this.currentShowcaseElement = 0;
	this.cycleShowCase = (direction) => {

		const els = showCaseEl.querySelectorAll(".showcaseElement");
		if(!els)return;
		
		this.currentShowcaseElement+=direction;
		if (this.currentShowcaseElement < 0) this.currentShowcaseElement = 0;
		else if (this.currentShowcaseElement > els.length - 1) this.currentShowcaseElement = 0;
		// console.log("Select", this.currentShowcaseElement,"of",els.length);

		const el = els[this.currentShowcaseElement];

		showCaseEl.style.transition="opacity 0.3s";
		// this.currentShowcaseElement.style.transitionTimingFunction="linear";
		showCaseEl.style.opacity=0;
		
		if(el){
		// setTimeout(()=>{
	
			setTimeout(()=>{
				els.forEach(el=>el.style.display = "none");				
				el.style.display = "block";
				showCaseEl.style.opacity=1;
				this.playCurrent();
			},400);
		// },10);
		}
		return this.currentShowcaseElement;
	}



	if(mode=="gallery"){
		let showCasePrev=showCaseEl.querySelector("#showCasePrev");
        if(!showCasePrev){
            showCasePrev=document.createElement("i");
            showCasePrev.setAttribute("id","showCasePrev");
            showCaseEl.append(showCasePrev);
        }

		let showCaseNext=showCaseEl.querySelector("#showCaseNext");
        if(!showCaseNext){
            showCaseNext=document.createElement("i");
            showCaseNext.setAttribute("id","showCaseNext");
            showCaseEl.append(showCaseNext);
        }

		showCasePrev.classList.add("fas");
		showCasePrev.classList.add("fa-chevron-left");


		showCaseNext.classList.add("fas");
		showCaseNext.classList.add("fa-chevron-right");
		

		showCasePrev.addEventListener("click", (ev) => {
			ev.stopPropagation();
			this.cycleShowCase(-1)
		});

		showCaseNext.addEventListener("click", (ev) => {
			ev.stopPropagation();
			this.cycleShowCase(1)
		});

	}

	this.playCurrent();


}
window.addEventListener("DOMContentLoaded", function () {
	document.querySelectorAll("#showcase").forEach(el=>new ShowCase(el));
});