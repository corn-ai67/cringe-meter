/**
 * CRINGE METER — LiveKit Cloud WebRTC Streaming Engine
 * Handles 2-way audio/video publication, remote track subscription, and media controls.
 */

class LiveKitClientEngine {
  constructor() {
    this.room = null;
    this.localStream = null;
    this.micMuted = false;
    this.cameraOff = false;
    this.callbacks = {};
  }

  registerCallbacks(cbs) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  getLiveKitSDK() {
    return window.LivekitClient || window.LiveKit || window.livekit || null;
  }

  async connectAndPublish(livekitConfig, localVideoEl, remoteVideoEl) {
    this.disconnect();
    this.micMuted = false;
    this.cameraOff = false;

    // Reset visual states
    const simulated = document.getElementById('simulatedOppVideo');
    const oppPlaceholder = document.getElementById('oppCameraOffPlaceholder');
    const camFallback = document.getElementById('camFallback');

    try {
      // 1. Start local camera feed preview first
      await this.startLocalMedia(localVideoEl);

      // 2. Connect to LiveKit Cloud if SDK is loaded and token is valid
      const LK = this.getLiveKitSDK();
      if (LK && livekitConfig && livekitConfig.token && !livekitConfig.isMock) {
        const { Room, RoomEvent, VideoPresets, Track } = LK;

        this.room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720 ? VideoPresets.h720.resolution : { width: 1280, height: 720 }
          }
        });

        // Track Subscribed Event (Remote stranger video/audio track)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log(`[LIVEKIT] Subscribed to ${participant.identity} track (${track.kind})`);
          this.attachRemoteTrack(track, remoteVideoEl);
        });

        // Track Unsubscribed
        this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log(`[LIVEKIT] Unsubscribed from ${participant.identity} track`);
          if (track.kind === 'video') {
            if (remoteVideoEl) {
              remoteVideoEl.classList.add('hidden');
              remoteVideoEl.srcObject = null;
            }
            if (simulated) {
              simulated.classList.remove('hidden');
              simulated.style.display = 'flex';
            }
          }
        });

        // Track Muted/Unmuted (Stranger Camera Off/On)
        this.room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (publication.kind === 'video') {
            if (oppPlaceholder) oppPlaceholder.classList.remove('hidden');
            if (remoteVideoEl) remoteVideoEl.classList.add('hidden');
          }
        });

        this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (publication.kind === 'video') {
            if (oppPlaceholder) oppPlaceholder.classList.add('hidden');
            if (remoteVideoEl) {
              remoteVideoEl.classList.remove('hidden');
              remoteVideoEl.style.display = 'block';
            }
          }
        });

        // Connect to LiveKit room
        const tokenStr = (livekitConfig.token && typeof livekitConfig.token === 'object') ? (livekitConfig.token.token || '') : (livekitConfig.token || '');
        await this.room.connect(livekitConfig.url, tokenStr);
        console.log(`[LIVEKIT] Successfully connected to room: ${livekitConfig.roomName}`);

        // Check for any participants already present in the room
        if (this.room.remoteParticipants) {
          this.room.remoteParticipants.forEach(participant => {
            if (participant.trackPublications) {
              participant.trackPublications.forEach(pub => {
                if (pub.track) {
                  this.attachRemoteTrack(pub.track, remoteVideoEl);
                }
              });
            }
          });
        }

        // Publish local camera & microphone
        if (this.room.localParticipant) {
          await this.room.localParticipant.setCameraEnabled(true);
          await this.room.localParticipant.setMicrophoneEnabled(true);
          console.log("[LIVEKIT] Local camera & mic enabled in LiveKit room.");
        }
      } else {
        console.log("[LIVEKIT] Running in local media preview mode.");
      }
    } catch (err) {
      console.warn("[LIVEKIT] Connection / media publish error:", err.message);
      if (this.callbacks.onMediaError) {
        this.callbacks.onMediaError(err.message);
      }
    }
  }

  attachRemoteTrack(track, remoteVideoEl) {
    const simulated = document.getElementById('simulatedOppVideo');
    const oppPlaceholder = document.getElementById('oppCameraOffPlaceholder');

    if (track.kind === 'video' && remoteVideoEl) {
      // Hide simulated placeholder and camera off box
      if (simulated) {
        simulated.classList.add('hidden');
        simulated.style.display = 'none';
      }
      if (oppPlaceholder) {
        oppPlaceholder.classList.add('hidden');
      }

      // Attach track to video element
      if (typeof track.attach === 'function') {
        track.attach(remoteVideoEl);
      } else if (track.mediaStreamTrack) {
        remoteVideoEl.srcObject = new MediaStream([track.mediaStreamTrack]);
      }

      remoteVideoEl.muted = true; // Audio is handled separately
      remoteVideoEl.setAttribute('playsinline', 'true');
      remoteVideoEl.setAttribute('webkit-playsinline', 'true');
      remoteVideoEl.classList.remove('hidden');
      remoteVideoEl.style.display = 'block';

      remoteVideoEl.play().catch(e => console.warn("[LIVEKIT] Remote video play policy:", e.message));
      console.log("[LIVEKIT] Remote video stream attached and displayed.");
    } else if (track.kind === 'audio') {
      if (typeof track.attach === 'function') {
        const audioEl = track.attach();
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('webkit-playsinline', 'true');
        document.body.appendChild(audioEl);
      } else if (track.mediaStreamTrack) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
        document.body.appendChild(audioEl);
        audioEl.play().catch(e => console.warn("[LIVEKIT] Audio play policy:", e.message));
      }
    }
  }

  async startLocalMedia(localVideoEl) {
    const camFallback = document.getElementById('camFallback');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true
        });

        if (localVideoEl) {
          localVideoEl.srcObject = this.localStream;
          localVideoEl.muted = true;
          localVideoEl.setAttribute('playsinline', 'true');
          localVideoEl.setAttribute('webkit-playsinline', 'true');
          localVideoEl.classList.remove('hidden');
          localVideoEl.style.display = 'block';

          if (camFallback) {
            camFallback.classList.add('hidden');
            camFallback.style.display = 'none';
          }

          localVideoEl.play().catch(e => console.warn("[LIVEKIT] Local video play policy:", e.message));
        }
      }
    } catch (err) {
      console.warn("[LIVEKIT] Camera/Mic access error:", err.name, err.message);
      if (camFallback) {
        camFallback.classList.remove('hidden');
        camFallback.style.display = 'flex';
        camFallback.innerHTML = `<span class="cam-fallback-text" style="color:var(--accent-magenta);">CAMERA NOT ACTIVE</span>`;
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

    const simulated = document.getElementById('simulatedOppVideo');
    const oppPlaceholder = document.getElementById('oppCameraOffPlaceholder');
    const remoteVideoEl = document.getElementById('remoteVideoFeed');

    if (remoteVideoEl) {
      remoteVideoEl.classList.add('hidden');
      remoteVideoEl.style.display = 'none';
      remoteVideoEl.srcObject = null;
    }
    if (simulated) {
      simulated.classList.remove('hidden');
      simulated.style.display = 'flex';
    }
    if (oppPlaceholder) {
      oppPlaceholder.classList.add('hidden');
    }
  }
}

window.livekitClientEngine = new LiveKitClientEngine();
