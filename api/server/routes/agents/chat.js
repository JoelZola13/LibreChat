const express = require('express');
const { generateCheckAccess, skipAgentCheck } = require('@librechat/api');
const { PermissionTypes, Permissions, PermissionBits } = require('librechat-data-provider');
const {
  moderateText,
  validateConvoAccess,
  buildEndpointOption,
  canAccessAgentFromBody,
} = require('~/server/middleware');
const { initializeClient } = require('~/server/services/Endpoints/agents');
const AgentController = require('~/server/controllers/agents/request');
const { streetBotProOwnerOnly } = require('~/server/middleware/streetBotProOwnerOnly');
let streetBotFastPathTools;
try {
  streetBotFastPathTools = require('/app/tools/streetbot-fastpath.cjs');
} catch (_) {
  streetBotFastPathTools = require('../../../../tools/streetbot-fastpath.cjs');
}
const { streetbotFastPath } = streetBotFastPathTools;
let streetBotTelemetry;
try {
  streetBotTelemetry = require('/app/tools/streetbot-telemetry.cjs');
} catch (_) {
  streetBotTelemetry = require('../../../../tools/streetbot-telemetry.cjs');
}
const {
  failStreetBotRequestTrace,
  finalizeStreetBotRequestTrace,
  runInStreetBotTrace,
} = streetBotTelemetry;
const addTitle = require('~/server/services/Endpoints/agents/title');
const { getRoleByName } = require('~/models/Role');

const router = express.Router();

const checkAgentAccess = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE],
  skipCheck: skipAgentCheck,
  getRoleByName,
});
const checkAgentResourceAccess = canAccessAgentFromBody({
  requiredPermission: PermissionBits.VIEW,
});

router.use(buildEndpointOption);
router.use(checkAgentAccess);
router.use(checkAgentResourceAccess);
router.use(validateConvoAccess);
router.use((req, res, next) => {
  if (req._streetbotFastPath && req._streetbotFastPath.toolBase !== 'conversation') {
    return next();
  }
  return moderateText(req, res, next);
});

const controller = async (req, res, next) => {
  const routeKind = req._streetbotFastPath ? 'fastpath' : 'agent';

  try {
    const result = await runInStreetBotTrace(req, async () => {
      if (req._streetbotFastPath) {
        return streetbotFastPath(req, res, next);
      }
      return AgentController(req, res, next, initializeClient, addTitle);
    });

    finalizeStreetBotRequestTrace(req, {
      output: {
        routeKind,
        fastPath: Boolean(req._streetbotFastPath),
        conversationId: req.body?.conversationId || 'new',
      },
      metadata: {
        routeKind,
      },
      attributes: {
        'streetbot.route.fast_path': Boolean(req._streetbotFastPath),
      },
    });
    return result;
  } catch (error) {
    failStreetBotRequestTrace(req, error, {
      metadata: {
        routeKind,
      },
      attributes: {
        'streetbot.route.fast_path': Boolean(req._streetbotFastPath),
      },
    });
    throw error;
  }
};

router.post('/', streetBotProOwnerOnly, controller);
router.post('/:endpoint', streetBotProOwnerOnly, controller);

module.exports = router;
