/**
 * CRINGE METER — LiveKit Cloud WebRTC Streaming Engine
 * Handles 2-way audio/video publication, remote track subscription, and media controls.
 */

class LiveKitClientEngine {
  constructor() {
    this.room = null;
    this.localStream = null;
    this.remoteStream = null;
    this.micMuted = false;
    this.cameraOff = false;
    this.callbacks = {};
  }

  registerCallbacks(cbs) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  async connectAndPublish(livekitConfig, localVideoEl, remoteVideoEl) {
    this.disconnect();
    this.micMuted = false;
    this.cameraOff = false;

    try {
      // 1. Start local camera feed preview first
      await this.startLocalMedia(localVideoEl);

      // 2. Connect to LiveKit Cloud if SDK available and token is valid
      if (window.LivekitClient && livekitConfig && livekitConfig.token && !livekitConfig.isMock) {
        const { Room, RoomEvent, VideoPresets } = window.LivekitClient;

        this.room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution
          }
        });

        // Track Subscribed Event (Remote stranger video/audio track)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log(`[LIVEKIT] Subscribed to ${participant.identity} track: ${track.kind}`);
          if (track.kind === 'video' && remoteVideoEl) {
            const mediaStream = new MediaStream([track.mediaStreamTrack]);
            remoteVideoEl.srcObject = mediaStream;
            remoteVideoEl.setAttribute('playsinline', 'true');
            remoteVideoEl.setAttribute('webkit-playsinline', 'true');
            remoteVideoEl.classList.remove('hidden');
            remoteVideoEl.play().catch(e => console.warn("[LIVEKIT] iOS remote video play:", e.message));

            const placeholder = document.getElementById('oppCameraOffPlaceholder');
            if (placeholder) placeholder.classList.add('hidden');
          } else if (track.kind === 'audio') {
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
            document.body.appendChild(audioEl);
            audioEl.play().catch(e => console.warn("[LIVEKIT] iOS audio play:", e.message));
          }
        });

        // Track Muted/Unmuted (Stranger Camera Off/On)
        this.room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (publication.kind === 'video') {
            const placeholder = document.getElementById('oppCameraOffPlaceholder');
            if (placeholder) placeholder.classList.remove('hidden');
          }
        });

        this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (publication.kind === 'video') {
            const placeholder = document.getElementById('oppCameraOffPlaceholder');
            if (placeholder) placeholder.classList.add('hidden');
          }
        });

        // Connect & publish camera + mic
        await this.room.connect(livekitConfig.url, livekitConfig.token);
        console.log(`[LIVEKIT] Connected to room ${livekitConfig.roomName}`);

        await this.room.localParticipant.enableCameraAndMicrophone();
        console.log("[LIVEKIT] Local camera and microphone published.");
      } else {
        console.log("[LIVEKIT] Using WebRTC media stream mode.");
      }
    } catch (err) {
      console.warn("LiveKit connection / media publish fallback:", err.message);
      if (this.callbacks.onMediaError) {
        this.callbacks.onMediaError(err.message);
      }
    }
  }

  async startLocalMedia(localVideoEl) {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true
        });

        if (localVideoEl) {
          localVideoEl.srcObject = this.localStream;
          localVideoEl.setAttribute('playsinline', 'true');
          localVideoEl.setAttribute('webkit-playsinline', 'true');
          localVideoEl.classList.remove('hidden');
          localVideoEl.play().catch(e => console.warn("[LIVEKIT] iOS local video play:", e.message));

          const fallback = document.getElementById('camFallback');
          if (fallback) fallback.classList.add('hidden');
        }
      }
    } catch (err) {
      console.warn("Camera/Mic access error:", err.name, err.message);
      const fallback = document.getElementById('camFallback');
      if (fallback) {
        fallback.innerHTML = `<span class="cam-fallback-text" style="color:var(--accent-magenta);">TAP TO ALLOW CAMERA ACCESS</span>`;
      }
    }
  }

  toggleMicrophone() {
    this.micMuted = !this.micMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = !this.micMuted);
    }
    if (this.room && this.room.localParticipant) {
      this.room.localParticipant.setMicrophoneEnabled(!this.micMuted);
    }
    return this.micMuted;
  }

  toggleCamera() {
    this.cameraOff = !this.cameraOff;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = !this.cameraOff);
    }
    if (this.room && this.room.localParticipant) {
      this.room.localParticipant.setCameraEnabled(!this.cameraOff);
    }
    return this.cameraOff;
  }

  disconnect() {
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (e) {}
      this.room = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }
}

window.livekitClientEngine = new LiveKitClientEngine();
