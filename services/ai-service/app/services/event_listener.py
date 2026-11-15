import os
import json
import logging
import threading
import time

logger = logging.getLogger("ai_event_listener")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
CHANNEL_NAME = "terrawatch:events"

def start_redis_listener():
    """Background worker listening to Redis Event Bus (Pub/Sub)"""
    def worker():
        # Retry loop to connect to Redis without blocking container startup
        time.sleep(2)
        subscribed = False
        while True:
            try:
                import redis
                r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
                pubsub = r.pubsub()
                pubsub.subscribe(CHANNEL_NAME)
                subscribed = True
                logger.info(f"📡 [AI Service EventBus] Subscribed to channel '{CHANNEL_NAME}' at {REDIS_HOST}:{REDIS_PORT}")

                for message in pubsub.listen():
                    if message and message['type'] == 'message':
                        data_str = message['data']
                        try:
                            event = json.loads(data_str)
                        except (ValueError, TypeError):
                            logger.warning(f"Failed to parse event message: {data_str}")
                            continue
                        if not isinstance(event, dict):
                            logger.warning(f"Ignoring event message that is not a JSON object: {data_str}")
                            continue
                        event_type = event.get('eventType', 'UNKNOWN')
                        event_id = event.get('eventId', 'N/A')
                        payload = event.get('payload', {})
                        logger.info(f"⚡ [EventBus Inbound] Type: {event_type} | ID: {event_id} | Payload: {payload}")

                        # If new satellite scene is ingested, trigger async preprocessing / batch inference
                        if event_type == "SATELLITE_SCENE_INGESTED":
                            if not isinstance(payload, dict):
                                logger.warning(f"Ignoring scene event with non-object payload: {event_id}")
                                continue
                            logger.info(f"🚀 [Async Processing] Initiating automated landslide segmentation for scene: {payload.get('scene_id')}")
                return
            except Exception as e:
                logger.warning(f"⚠️ [EventBus Warning] Redis not reachable at {REDIS_HOST}:{REDIS_PORT}: {e}")
                # Retry only a stream that was live; a failed first connection still ends the worker.
                if not (subscribed and isinstance(e, (ConnectionError, getattr(redis, "ConnectionError", ConnectionError)))):
                    return
                time.sleep(2)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
