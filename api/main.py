from flask import Flask, jsonify, request
from aliases import load_aliases
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Load aliases on startup
aliases = load_aliases()

@app.route('/api/health')
def health_check():
    app.logger.info('Health check endpoint called')
    return jsonify({'status': 'ok'})

@app.route('/api/aliases', methods=['GET'])
def get_aliases():
    return jsonify(aliases)

@app.route('/api/aliases/reload', methods=['POST'])
def reload_aliases_endpoint():
    global aliases
    aliases = load_aliases()
    app.logger.info('Aliases reloaded')
    return jsonify({'status': 'aliases reloaded'})

@app.route('/api/normalize', methods=['POST'])
def normalize_endpoint():
    data = request.get_json()
    text = data.get('text', '')
    app.logger.info(f'Normalizing text: {text}')
    # Placeholder for normalization logic
    return jsonify({'original': text, 'normalized': text})
