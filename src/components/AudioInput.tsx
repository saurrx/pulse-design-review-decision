import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import appConfig from '@/lib/appConfig';
import { useTheme } from '@/hooks/useTheme';

interface AudioInputProps {
  onTranscript: (transcript: string) => void;
  languageCode?: 'en-US' | 'en-IN';
  disabled?: boolean;
}

/**
 * Audio Input Component
 * Captures audio from microphone and transcribes it in real-time using Deepgram
 * Supports both US and Indian English accents
 */
const AudioInput: React.FC<AudioInputProps> = ({ 
  onTranscript, 
  languageCode = 'en-IN',
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const { theme } = useTheme();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  /**
   * Convert Float32Array to 16-bit PCM
   */
  const convertToPCM16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return int16Array;
  };

  /**
   * Start real-time audio streaming and transcription
   */
  const startRecording = async () => {
    try {
      setIsConnecting(true);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      audioContextRef.current = audioContext;

      // Create audio source and processor
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect audio nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Set up WebSocket connection using appConfig
      const apiHostUrl = appConfig.API_HOST_URL;

      // Convert HTTP/HTTPS URL to WebSocket URL
      let wsUrl: string;
      if (apiHostUrl.startsWith("https://")) {
        wsUrl = apiHostUrl.replace("https://", "wss://");
      } else if (apiHostUrl.startsWith("http://")) {
        wsUrl = apiHostUrl.replace("http://", "ws://");
      } else {
        // Fallback to localhost for development
        wsUrl = "ws://localhost:3500";
      }

      // Build WebSocket URL with query parameters
      // Auth token is sent automatically via HttpOnly cookie for same-site connections
      const url = new URL(`${wsUrl}/api/patents/transcribe/stream`);
      url.searchParams.append("languageCode", languageCode);

      const finalWsUrl = url.toString();
      console.log('Connecting to WebSocket:', finalWsUrl);
      const ws = new WebSocket(finalWsUrl);
      wsRef.current = ws;
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timeout');
          ws.close();
          setIsConnecting(false);
          toast({
            title: "Connection timeout",
            description: "Could not connect to transcription service. Please check if the backend server is running.",
            variant: "destructive"
          });
        }
      }, 5000);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received transcript:', data);

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.transcript) {
            // Handle partial and final transcripts
            if (data.isPartial) {
              // Show partial transcript in real-time (temporary, will be replaced)
              const partialText = accumulatedTranscriptRef.current + data.transcript;
              // Send just the new transcribed portion to append
              onTranscript(partialText);
            } else {
              // Final transcript - add to accumulated text
              accumulatedTranscriptRef.current += data.transcript + ' ';
              // Send the accumulated transcribed text
              onTranscript(accumulatedTranscriptRef.current.trim());
            }
          }

          if (data.complete) {
            // Final transcript received
            if (accumulatedTranscriptRef.current) {
              onTranscript(accumulatedTranscriptRef.current.trim());
              toast({
                title: "Transcription complete",
                description: "Your speech has been converted to text",
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        toast({
          title: "Connection error",
          description: "Failed to connect to transcription service. Make sure the backend server is running and DEEPGRAM_API_KEY is configured.",
          variant: "destructive"
        });
        stopRecording();
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setIsConnecting(false);
        if (isRecording) {
          setIsRecording(false);
          if (!event.wasClean && event.code !== 1000) {
            toast({
              title: "Connection closed",
              description: "WebSocket connection was closed unexpectedly",
              variant: "destructive"
            });
          }
        }
      };

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected for transcription');
        setIsConnecting(false);
        setIsRecording(true);
        accumulatedTranscriptRef.current = '';
        
        // Mark connection as ready after a short delay to ensure stability
        let isConnectionReady = false;
        setTimeout(() => {
          isConnectionReady = true;
          console.log('Connection ready, starting audio transmission');
          toast({
            title: "Recording started",
            description: "Speak your patent idea...",
          });
        }, 300);
        
        processor.onaudioprocess = (event) => {
          // Only send audio if connection is ready and open
          if (!ws || ws.readyState !== WebSocket.OPEN || !isConnectionReady) {
            return;
          }

          try {
            const inputData = event.inputBuffer.getChannelData(0);
            
            // Skip if no audio data
            if (!inputData || inputData.length === 0) {
              return;
            }
            
            // Convert to 16-bit PCM
            const pcm16 = convertToPCM16(inputData);
            
            // Convert to base64 for transmission
            const uint8Array = new Uint8Array(pcm16.buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            
            if (!binary) {
              return;
            }
            
            const base64Audio = btoa(binary);

            // Send audio chunk to server as JSON string
            if (base64Audio && base64Audio.length > 0) {
              const message = JSON.stringify({
                type: 'audio',
                data: base64Audio
              });
              
              // Check if message is too large (WebSocket has limits)
              if (message.length > 65536) {
                console.warn('Audio chunk too large, skipping');
                return;
              }
              
              ws.send(message);
            }
          } catch (error) {
            console.error('Error processing audio:', error);
          }
        };
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      setIsConnecting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast({
          title: "Permission Denied",
          description: "Please allow microphone access to use voice input.",
          variant: "destructive"
        });
      } else if (errorMessage.includes('not found') || errorMessage.includes('device')) {
        toast({
          title: "Microphone Not Found",
          description: "No microphone detected. Please connect a microphone and try again.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error Starting Recording",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  };

  /**
   * Stop recording and close connections
   */
  const stopRecording = () => {
    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      // Send end message before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    if (isRecording) {
      setIsRecording(false);
      if (accumulatedTranscriptRef.current.trim()) {
        toast({
          title: "Recording stopped",
          description: "Your speech has been converted to text",
        });
      }
    }
    setIsConnecting(false);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button
      onClick={handleToggleRecording}
      disabled={disabled || isConnecting}
      className={` p-0 hover:shadow-lg transition-shadow border-none bg-none ${theme === 'dark' ? "text-zinc-200" : "text-zinc-900"}`}
      title={isConnecting ? "Connecting..." : isRecording ? "Stop Recording" : "Start Voice Input"}
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
};

export default AudioInput;
