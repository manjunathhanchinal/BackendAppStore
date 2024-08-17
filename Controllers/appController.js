const mongoose = require('mongoose');
const App = require('../models/appModel');

// Create App (Admin Only)
exports.addApp = async (req, res) => {
    const { name, description, version, releasedate, rating, genre, visibility } = req.body;

    try {
        const app = new App({
            name,
            description,
            version,
            releasedate,
            rating,
            genre,
            user: req.user._id,
            visibility,
        });
        await app.save();
        res.status(201).json({ message: 'App added', app });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get All Apps
exports.getApps = async (req, res) => {
    try {
        const userId = req.user ? req.user._id : null;
        const isAdmin = req.user && req.user.role === 'admin';

        // Build query based on user's role
        const query = isAdmin
            ? {} // Admins see all apps
            : { $or: [{ visibility: 'public' }, { user: userId, visibility: 'private' }] }; // Users see public apps and their own private apps

        const apps = await App.find(query);

        // Modify response to include downloadCount only for apps that the user has downloaded or if the user is admin
        const responseApps = apps.map(app => {
            const hasDownloaded = app.downloadedBy.some(user => user.toString() === userId.toString());
            return {
                id: app._id,
                name: app.name,
                version: app.version,
                description: app.description,
                rating: app.rating,
                releasedate: app.releasedate,
                genre: app.genre,
                visibility: app.visibility,
                user: app.user,
                downloadCount: isAdmin || hasDownloaded ? app.downloadCount : undefined, // Only show downloadCount if admin or user has downloaded
            };
        });

        res.json(responseApps);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get App By ID
exports.getAppById = async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);

        if (!app) return res.status(404).json({ message: 'App not found' });

        const userId = req.user._id;
        const isAdmin = req.user.role === 'admin';
        const isOwner = app.user.toString() === req.user._id.toString();

        if (app.visibility === 'private' && !isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Not authorized to view this app' });
        }

        const hasDownloaded = app.downloadedBy.some(user => user.toString() === userId.toString());

        res.json({
            app: {
                id: app._id,
                name: app.name,
                version: app.version,
                description: app.description,
                rating: app.rating,
                releasedate: app.releasedate,
                genre: app.genre,
                visibility: app.visibility,
                downloadCount: isAdmin || hasDownloaded ? app.downloadCount : undefined, // Show downloadCount only if user has downloaded or admin
                user: app.user,
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};


// Get App By name
// Handler function for getting app details by name
exports.getAppByname = async (req, res) => {
    try {
        // Extract the app name from the route parameters
        const appName =req.params.appname;

        // Find the app by name and populate user and downloadedBy fields
        const app = await App.findOne({ name: appName }).populate('user').populate('downloadedBy');

        // Handle the case where no app is found
        if (!app) {
            return res.status(404).json({ message: 'App not found' });
        }

        // Extract user information from request
        const userId = req.user._id;
        const isAdmin = req.user.role === 'admin';
        const isOwner = app.user._id.toString() === userId.toString(); // Comparing user IDs

        // Check visibility and authorization
        if (app.visibility === 'private' && !isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Not authorized to view this app' });
        }

        // Check if the user has downloaded the app
        const hasDownloaded = app.downloadedBy.some(user => user._id.toString() === userId.toString());

        // Prepare the response data
        const responseData = {
            id: app._id,
            name: app.name,
            version: app.version,
            description: app.description,
            rating: app.rating,
            releasedate: app.releasedate,
            genre: app.genre,
            visibility: app.visibility,
            user: {
                id: app.user._id,
                name: app.user.name,
            }
        };

        // Conditionally include downloadCount if the user is an admin or has downloaded the app
        if (isAdmin || hasDownloaded) {
            responseData.downloadCount = app.downloadCount;
        }

        // Send the app details in the response
        res.json({ app: responseData });
    } catch (error) {
        // Handle any server errors and log for debugging
        console.error(error); // Log the error to the server console
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};



// Update App (Admin Only)
exports.updateApp = async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);

        if (!app) return res.status(404).json({ message: 'App not found' });

        if (app.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this app' });
        }

        const updatedApp = await App.findByIdAndUpdate(req.params.appId, req.body, { new: true });

        res.json({ message: 'App updated', updatedApp });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete App (Admin Only)
exports.deleteApp = async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);

        if (!app) return res.status(404).json({ message: 'App not found' });

        if (app.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this app' });
        }

        await App.findByIdAndDelete(req.params.appId);
        res.json({ message: 'App deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Download App and Increment Download Count
exports.downloadApp = async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);

        if (!app) return res.status(404).json({ message: 'App not found' });

        const userId = req.user._id;
        
        // Increment download count for admin
        if (!app.downloadedBy.includes(userId)) {
            app.downloadedBy.push(userId); // Track user who downloaded
        }

        // Increment total download count
        app.downloadCount += 1;

        await app.save();

        res.json({ message: 'Download successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Download Count (Admin Only)
exports.getDownloadCount = async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);

        if (!app) return res.status(404).json({ message: 'App not found' });

        res.json({ downloadCount: app.downloadCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};


