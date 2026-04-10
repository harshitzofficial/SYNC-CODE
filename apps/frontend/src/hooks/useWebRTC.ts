import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const useWebRTC = (socket: WebSocket | null, userId: string, roomId: string, connectedUsers: any[]) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const makingOffer = useRef<Record<string, boolean>>({});
    const ignoreOffer = useRef<Record<string, boolean>>({});
    const isSettingRemoteAnswerPending = useRef<Record<string, boolean>>({});

    const [micEnabled, setMicEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

    const createPeerConnection = useCallback((targetUserId: string) => {
        if (peerConnections.current[targetUserId]) return peerConnections.current[targetUserId];

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[targetUserId] = pc;
        makingOffer.current[targetUserId] = false;
        ignoreOffer.current[targetUserId] = false;
        isSettingRemoteAnswerPending.current[targetUserId] = false;

        pc.onicecandidate = ({ candidate }) => {
            if (candidate && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "webrtc_ice_candidate",
                    targetUserId,
                    candidate: candidate,
                    roomId
                }));
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams((prev) => {
                // Get the active stream or create a fresh one natively
                let currentStream = prev[targetUserId];
                if (!currentStream) {
                    currentStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream();
                }
                
                // Add the new arriving track and clean up old zombie tracks of the same kind
                if (!currentStream.getTracks().find(t => t.id === event.track.id)) {
                    const oldMatch = currentStream.getTracks().find(t => t.kind === event.track.kind);
                    if (oldMatch) {
                        currentStream.removeTrack(oldMatch);
                    }
                    currentStream.addTrack(event.track);
                }

                // Return a structurally NEW MediaStream array reference so React physically re-triggers the `<video srcObject>`!
                return {
                    ...prev,
                    [targetUserId]: new MediaStream(currentStream.getTracks())
                };
            });
        };

        pc.onnegotiationneeded = async () => {
             try {
                 makingOffer.current[targetUserId] = true;
                 const offer = await pc.createOffer();
                 if (pc.signalingState !== "stable") return;
                 await pc.setLocalDescription(offer);
                 if (socket && socket.readyState === WebSocket.OPEN) {
                     socket.send(JSON.stringify({
                         type: "webrtc_offer",
                         targetUserId,
                         offer: pc.localDescription,
                         roomId
                     }));
                 }
             } catch (e) {
                 console.error("Renegotiation failed", e);
             } finally {
                 makingOffer.current[targetUserId] = false;
             }
        };

        pc.oniceconnectionstatechange = () => {
             if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed') {
                 setRemoteStreams(prev => {
                     const newStreams = { ...prev };
                     delete newStreams[targetUserId];
                     return newStreams;
                 });
             }
        };

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                try { pc.addTrack(track, localStream); } catch(e) {}
            });
        }

        return pc;
    }, [localStream, socket, roomId]);

    useEffect(() => {
        if (!socket) return;
        connectedUsers.forEach((user) => {
            if (user.id !== userId && !peerConnections.current[user.id]) {
                createPeerConnection(user.id);
            }
        });
    }, [connectedUsers, socket, userId, createPeerConnection, roomId]);

    // Track sync purely based on MediaStream changes
    useEffect(() => {
        if (!localStream) return;
        Object.entries(peerConnections.current).forEach(([_, pc]) => {
            if (pc.signalingState === "closed") return;
            const senders = pc.getSenders();
            localStream.getTracks().forEach(track => {
                const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
                if (existingSender) {
                    if (existingSender.track?.id !== track.id) {
                        try {
                            pc.removeTrack(existingSender);
                            pc.addTrack(track, localStream);
                        } catch(e) {
                            console.error("Remove/Add track fallback error", e);
                        }
                    }
                } else {
                    try { pc.addTrack(track, localStream); } catch(e) {}
                }
            });
        });
    }, [localStream]);

    useEffect(() => {
        let isCancelled = false;
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                if (isCancelled) {
                    stream.getTracks().forEach(track => track.stop());
                } else {
                    setLocalStream(stream);
                }
            })
            .catch((err) => console.error("Error accessing media devices.", err));

        return () => {
            isCancelled = true;
        };
    }, []);

    // Perfect negotiation incoming handler
    useEffect(() => {
        if (!socket) return;

        const handleMessage = async (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (!data.type?.startsWith("webrtc_")) return;

                if (!data.senderId) return;

                let pc = peerConnections.current[data.senderId];
                if (!pc) {
                    pc = createPeerConnection(data.senderId);
                }

                if (data.type === "webrtc_offer") {
                    const polite = userId > data.senderId;
                    const offerCollision = data.offer.type === "offer" && 
                        (makingOffer.current[data.senderId] || pc.signalingState !== "stable");

                    ignoreOffer.current[data.senderId] = !polite && offerCollision;
                    if (ignoreOffer.current[data.senderId]) {
                        return;
                    }

                    if (pc.signalingState !== "stable") {
                        await Promise.all([
                            pc.setLocalDescription({ type: "rollback" }),
                            pc.setRemoteDescription(new RTCSessionDescription(data.offer))
                        ]);
                    } else {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    }

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: "webrtc_answer",
                            targetUserId: data.senderId,
                            answer: pc.localDescription,
                            roomId
                        }));
                    }
                }

                if (data.type === "webrtc_answer") {
                    if (pc.signalingState === "have-local-offer") {
                        isSettingRemoteAnswerPending.current[data.senderId] = true;
                        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                        isSettingRemoteAnswerPending.current[data.senderId] = false;
                    }
                }

                if (data.type === "webrtc_ice_candidate") {
                    try {
                        if (data.candidate && data.candidate.candidate) {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                    } catch(err) {
                        if (!ignoreOffer.current[data.senderId]) {
                            console.error("Ice candidate error", err);
                        }
                    }
                }

            } catch (err) {
                console.error("Error handling webrtc message", err);
            }
        };

        socket.addEventListener("message", handleMessage);

        return () => {
            socket.removeEventListener("message", handleMessage);
        };
    }, [socket, createPeerConnection, roomId, userId]);

    const toggleMic = async () => {
        if (!localStream) return;
        
        if (micEnabled) {
            localStream.getAudioTracks().forEach(track => {
                track.stop();
            });
            setMicEnabled(false);
        } else {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newTrack = newStream.getAudioTracks()[0];
                
                const oldTrack = localStream.getAudioTracks()[0];
                if (oldTrack) localStream.removeTrack(oldTrack);
                localStream.addTrack(newTrack);
                
                // Force React to recognize the stream internally updated
                setLocalStream(new MediaStream(localStream.getTracks()));

                setMicEnabled(true);
            } catch(e) { console.error(e); }
        }
    };

    const toggleVideo = async () => {
        if (!localStream) return;
        
        if (videoEnabled) {
            localStream.getVideoTracks().forEach(track => {
                track.stop();
            });
            setVideoEnabled(false);
        } else {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newTrack = newStream.getVideoTracks()[0];
                
                const oldTrack = localStream.getVideoTracks()[0];
                if (oldTrack) localStream.removeTrack(oldTrack);
                localStream.addTrack(newTrack);

                // Force React to recognize the stream internally updated
                setLocalStream(new MediaStream(localStream.getTracks()));

                setVideoEnabled(true);
            } catch(e) { console.error(e); }
        }
    };

    return { 
        localStream, remoteStreams, 
        toggleMic, toggleVideo, 
        micEnabled, videoEnabled
    };
};
